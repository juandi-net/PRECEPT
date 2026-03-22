import { invokeAndValidate } from '../ai/validate.js';
import { invokeAgent } from '../ai/invoke.js';
import { CuratorOutputSchema } from '../ai/schemas.js';
import { CURATOR_SYSTEM_PROMPT, buildCuratorMessage } from '../ai/prompts/curator.js';
import { upsertSkill, getAllActiveSkillNames } from '../db/skills.js';
import { getRecentEvents } from '../db/audit.js';
import { getRecentLessons } from '../db/decisions.js';
import { logEvent } from '../db/audit.js';
import { logSkillEvent } from '../db/skill-events.js';
import { getActiveRoleMemoryEntries } from '../db/role-memory.js';
import { upsertRoleSummary } from '../db/role-summaries.js';
import type { AuditEventType } from '@precept/shared';
import { roleRegistry } from '../config/role-registry.js';

interface CuratorAction {
  type: 'create' | 'refine' | 'deprecate';
  name: string;
  scope: 'org_wide' | 'role_specific';
  role: string | null;
  tags: string[];
  content?: string;
}

interface CuratorOutput {
  actions: CuratorAction[];
  reasoning: string;
}

interface CuratorResult {
  created: number;
  refined: number;
  deprecated: number;
}

export class CuratorService {
  async extractSkills(orgId: string): Promise<CuratorResult> {
    const start = Date.now();
    console.log('[curator] starting skill extraction...');

    // Gather evaluation patterns
    const [recentEvents, lessons, existingSkills] = await Promise.all([
      getRecentEvents(orgId, 100),
      getRecentLessons(orgId, 20),
      getAllActiveSkillNames(orgId),
    ]);

    // Extract review and judge patterns from audit events
    const reviewPatterns = recentEvents
      .filter(e => e.event_type === 'review.verdict')
      .map(e => {
        const meta = e.metadata;
        return {
          verdict: (meta?.verdict as string) ?? 'unknown',
          feedback: (meta?.feedback as string) ?? '',
          role: (meta?.role as string) ?? 'unknown',
        };
      });

    const judgePatterns = recentEvents
      .filter(e => e.event_type === 'judge.verdict')
      .map(e => {
        const meta = e.metadata;
        return {
          verdict: (meta?.verdict as string) ?? 'unknown',
          assessment: (meta?.assessment as string) ?? '',
          role: (meta?.role as string) ?? 'unknown',
        };
      });

    // Invoke Curator (Sonnet) — SchemaValidationError propagates to cycle handler
    const model = await roleRegistry.getModel(orgId, 'curator');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'curator');
    const { data: output } = await invokeAndValidate('Curator-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: CURATOR_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildCuratorMessage({
          reviewPatterns,
          judgePatterns,
          lessons: lessons.map(l => ({ whatTried: l.whatTried, whatLearned: l.whatLearned })),
          existingSkills,
        }),
      }],
      temperature: 0.4,
      jsonMode: true,
    }, CuratorOutputSchema, 'curator output');

    // Process actions
    const result: CuratorResult = { created: 0, refined: 0, deprecated: 0 };

    for (const action of output.actions) {
      try {
        switch (action.type) {
          case 'create':
          case 'refine':
            if (!action.content) continue;
            await upsertSkill({
              orgId,
              name: action.name,
              scope: action.scope,
              role: action.role,
              status: 'active',
              triggerTags: action.tags,
              content: action.content,
            });
            if (action.type === 'create') result.created++;
            else result.refined++;
            const skillEventType: AuditEventType = action.type === 'create'
              ? 'curator.skill_created' : 'curator.skill_refined';
            logEvent(orgId, skillEventType, 'Curator-1', {
              skillName: action.name,
            });
            logSkillEvent({
              orgId,
              skillName: action.name,
              eventType: action.type === 'create' ? 'created' : 'refined',
              metadata: { scope: action.scope, role: action.role, tags: action.tags },
            });
            break;

          case 'deprecate':
            await upsertSkill({
              orgId,
              name: action.name,
              scope: action.scope,
              role: action.role,
              status: 'deprecated',
              triggerTags: action.tags,
            });
            result.deprecated++;
            logEvent(orgId, 'curator.skill_deprecated', 'Curator-1', {
              skillName: action.name,
            });
            logSkillEvent({
              orgId,
              skillName: action.name,
              eventType: 'deprecated',
              metadata: { scope: action.scope, role: action.role },
            });
            break;
        }
      } catch (err) {
        console.error(`[curator] action failed for ${action.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logEvent(orgId, 'curator.cycle', 'Curator-1', {
      created: result.created,
      refined: result.refined,
      deprecated: result.deprecated,
      reasoning: output.reasoning,
    });

    // Generate role summaries after skill extraction
    try {
      const summaryCount = await this.generateRoleSummaries(orgId);
      if (summaryCount > 0) {
        console.log(`[curator] generated ${summaryCount} role summaries`);
      }
    } catch (err) {
      console.error(`[curator] role summary generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log(`[curator] done — ${result.created} created, ${result.refined} refined, ${result.deprecated} deprecated (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    return result;
  }

  async generateRoleSummaries(orgId: string): Promise<number> {
    const roles = await roleRegistry.getAll(orgId);
    const executionRoles = roles.filter(r => r.tier === 'execution');
    let generated = 0;

    for (const roleConfig of executionRoles) {
      try {
        const entries = await getActiveRoleMemoryEntries(orgId, roleConfig.role);
        if (entries.length === 0) continue;

        const entriesText = entries.map((e, i) =>
          `${i + 1}. [${e.entryType}] (${e.confidence}) ${e.content}`
        ).join('\n');

        const model = await roleRegistry.getModel(orgId, 'curator');
        const endpoint = await roleRegistry.getEndpoint(orgId, 'curator');
        const { content } = await invokeAgent('Curator-1', {
          orgId,
          model,
          endpoint,
          systemPrompt: 'You distill role memory entries into a concise domain knowledge summary for a worker. Output ONLY the summary text, no JSON wrapper. Target ~1000 tokens. Organize by theme. Focus on actionable patterns and key findings. Skip low-confidence entries unless they represent unique knowledge.',
          messages: [{ role: 'user', content: `Summarize these ${entries.length} memory entries for the "${roleConfig.role}" role:\n\n${entriesText}` }],
          temperature: 0.3,
        });

        if (content.trim().length > 0) {
          const tokenEstimate = Math.ceil(content.length / 4);
          await upsertRoleSummary(orgId, roleConfig.role, content.trim(), tokenEstimate);
          generated++;
          logEvent(orgId, 'curator.role_summary', 'Curator-1', {
            role: roleConfig.role,
            entryCount: entries.length,
            tokenEstimate,
          });
        }
      } catch (err) {
        console.error(`[curator] role summary failed for ${roleConfig.role}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return generated;
  }

}
