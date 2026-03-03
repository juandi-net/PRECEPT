import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ai, MODELS } from '../ai/client.js';
import { buildSkillAuthoringMessages } from '../ai/prompts/skill-authoring.js';
import * as skillsDb from '../db/skills.js';
import * as auditDb from '../db/audit.js';
import { SEED_SKILLS } from '@precept/shared';
import type { PreceptsDraft, SkillIndex, SeedSkillSpec } from '@precept/shared';

const AGENT_ID = 'seed-skill-generator';
// Resolve monorepo root from this file's location (packages/engine/src/services/skills.ts → ../../../../)
const __dirname = join(fileURLToPath(import.meta.url), '..');
const MONOREPO_ROOT = join(__dirname, '..', '..', '..', '..');
const SKILLS_DIR = join(MONOREPO_ROOT, 'skills');

export class SeedSkillService {
  async generateSeedSkills(precepts: PreceptsDraft): Promise<SkillIndex[]> {
    const messages = buildSkillAuthoringMessages(precepts, SEED_SKILLS);
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

      await auditDb.logEvent('ai.call', AGENT_ID, {
        model: MODELS.sonnet,
        purpose: 'seed_skill_generation',
        latencyMs,
        tokensIn: response.usage?.prompt_tokens ?? null,
        tokensOut: response.usage?.completion_tokens ?? null,
      }, response.usage?.total_tokens ?? undefined);
    } catch (err: any) {
      await auditDb.logEvent('skills.seed_failed', AGENT_ID, {
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
      await auditDb.logEvent('skills.seed_failed', AGENT_ID, {
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

        await auditDb.logEvent('skills.seed_generated', AGENT_ID, {
          skillName: spec.name,
          filePath: skill.filePath,
        });
      } catch (err: any) {
        await auditDb.logEvent('skills.seed_failed', AGENT_ID, {
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
    const scopeDir = spec.scope === 'org_wide' ? 'org-wide' : spec.scope;
    const relativePath = `skills/${scopeDir}/${spec.name}.md`;
    const absolutePath = join(SKILLS_DIR, scopeDir, `${spec.name}.md`);

    // Build the full skill file
    const fileContent = `# ${spec.name}

**Scope:** ${spec.scope.replace('_', '-')}
**Source:** Generated from Precepts at onboarding
**Tags:** ${spec.tags.join(', ')}

${content}
`;

    // Ensure directory exists and write file
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, fileContent, 'utf-8');

    // Insert into skill_index
    return skillsDb.insertSkill({
      name: spec.name,
      scope: spec.scope,
      role: null,
      status: 'active',
      triggerTags: spec.tags,
      filePath: relativePath,
    });
  }
}
