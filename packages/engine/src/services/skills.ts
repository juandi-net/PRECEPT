import { ai, MODELS } from '../ai/client.js';
import { buildSkillAuthoringMessages } from '../ai/prompts/skill-authoring.js';
import * as skillsDb from '../db/skills.js';
import * as auditDb from '../db/audit.js';
import { SEED_SKILLS } from '@precept/shared';
import type { CornerstoneDraft, SkillIndex, SeedSkillSpec } from '@precept/shared';

const AGENT_ID = 'seed-skill-generator';
const ORG_ID = process.env.DEFAULT_ORG_ID ?? 'onboarding';

export class SeedSkillService {
  async generateSeedSkills(cornerstone: CornerstoneDraft): Promise<SkillIndex[]> {
    const messages = buildSkillAuthoringMessages(cornerstone, SEED_SKILLS);
    const startMs = Date.now();

    let rawContent: string;
    try {
      const response = await ai.chat.completions.create({
        model: MODELS.sonnet,
        messages: messages as any,
        temperature: 0.4,
      });

      rawContent = response.choices[0]?.message?.content ?? '';
      const latencyMs = Date.now() - startMs;

      await auditDb.logEvent(ORG_ID, 'ai.call', AGENT_ID, {
        model: MODELS.sonnet,
        purpose: 'seed_skill_generation',
        latencyMs,
        tokensIn: response.usage?.prompt_tokens ?? null,
        tokensOut: response.usage?.completion_tokens ?? null,
      }, response.usage?.total_tokens ?? undefined);
    } catch (err: any) {
      await auditDb.logEvent(ORG_ID, 'skills.seed_failed', AGENT_ID, {
        error: err.message,
        stage: 'llm_call',
      });
      console.error(`Seed skill generation failed (LLM call): ${err.message}`);
      return [];
    }

    // Parse the LLM response
    let skillContents: Record<string, string>;
    try {
      skillContents = this.parseResponse(rawContent);
    } catch (err: any) {
      await auditDb.logEvent(ORG_ID, 'skills.seed_failed', AGENT_ID, {
        error: err.message,
        stage: 'parse',
        rawContent,
      });
      console.error(`Seed skill generation failed (parse): ${err.message}`);
      return [];
    }

    // Write files and insert DB records
    const created: SkillIndex[] = [];
    for (const spec of SEED_SKILLS) {
      const content = skillContents[spec.name];
      if (!content) {
        console.error(`Seed skill "${spec.name}" missing from LLM response`);
        continue;
      }

      try {
        const skill = await this.writeSkill(spec, content);
        created.push(skill);

        await auditDb.logEvent(ORG_ID, 'skills.seed_generated', AGENT_ID, {
          skillName: spec.name,
          contentLength: skill.content?.length ?? 0,
        });
      } catch (err: any) {
        await auditDb.logEvent(ORG_ID, 'skills.seed_failed', AGENT_ID, {
          error: err.message,
          stage: 'write',
          skillName: spec.name,
        });
        console.error(`Seed skill "${spec.name}" write failed: ${err.message}`);
      }
    }

    return created;
  }

  private parseResponse(raw: string): Record<string, string> {
    // Strip markdown fences if present
    const stripped = raw
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      // Try to find JSON object in prose
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON object found in LLM response');
      parsed = JSON.parse(match[0]);
    }

    // Validate: each seed skill must have content with a Guidance section
    for (const spec of SEED_SKILLS) {
      const content = parsed[spec.name];
      if (typeof content !== 'string') {
        throw new Error(`Missing or invalid content for skill "${spec.name}"`);
      }
      if (!content.includes('## Guidance')) {
        throw new Error(`Skill "${spec.name}" missing required ## Guidance section`);
      }
    }

    return parsed;
  }

  private async writeSkill(spec: SeedSkillSpec, content: string): Promise<SkillIndex> {
    const fileContent = `# ${spec.name}

**Scope:** ${spec.scope.replace('_', '-')}
**Source:** Generated from Cornerstone at onboarding
**Tags:** ${spec.tags.join(', ')}

${content}
`;

    return skillsDb.upsertSkill({
      orgId: ORG_ID,
      name: spec.name,
      description: spec.description,
      scope: spec.scope,
      role: null,
      status: 'active',
      triggerTags: spec.tags,
      content: fileContent,
    });
  }
}
