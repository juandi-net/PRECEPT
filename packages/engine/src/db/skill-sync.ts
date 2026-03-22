/**
 * @deprecated Replaced by skill-content-migration.ts.
 * Skills are now stored in skill_index.content, not on the filesystem.
 * This script is kept for reference only — do not use it.
 *
 * Original purpose: scanned skills/ for SKILL.md files, parsed metadata,
 * and upserted into the skill_index table.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = join(__dirname, '..', '..', '..', '..');
const SKILLS_DIR = join(MONOREPO_ROOT, 'skills');
const ORG_ID = process.env.DEFAULT_ORG_ID ?? 'onboarding';

interface SkillMeta {
  name: string;
  description: string;
  scope: string;
  role: string | null;
  status: string;
  tags: string[];
  filePath: string; // relative to monorepo root
}

function parseMetadata(content: string, filePath: string, name: string): SkillMeta | null {
  const scopeMatch = content.match(/^\*\*Scope:\*\*\s*(.+)$/m);
  const statusMatch = content.match(/^\*\*Status:\*\*\s*(.+)$/m);
  const tagsMatch = content.match(/^\*\*Tags:\*\*\s*(.+)$/m);
  const roleMatch = content.match(/^\*\*Role:\*\*\s*(.+)$/m);

  if (!scopeMatch || !statusMatch) {
    console.warn(`  Skipping ${filePath}: missing Scope or Status`);
    return null;
  }

  const scope = scopeMatch[1].trim().replace('-', '_'); // org-wide → org_wide
  const status = statusMatch[1].trim();
  const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
  const role = roleMatch ? roleMatch[1].trim() : null;

  // Extract description from ## When To Use or first paragraph after metadata
  const whenMatch = content.match(/## When To Use\s*\n+(.+)/);
  const contextMatch = content.match(/## Context\s*\n+(.+)/);
  const description = whenMatch?.[1]?.trim() ?? contextMatch?.[1]?.trim() ?? '';

  return { name, description, scope, role, status, tags, filePath };
}

async function findSkillFiles(dir: string): Promise<Array<{ absPath: string; name: string }>> {
  const results: Array<{ absPath: string; name: string }> = [];

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Check for SKILL.md inside this directory (role-specific pattern)
      try {
        const skillPath = join(fullPath, 'SKILL.md');
        await stat(skillPath);
        results.push({ absPath: skillPath, name: entry.name });
      } catch {
        // No SKILL.md — recurse deeper
        const nested = await findSkillFiles(fullPath);
        results.push(...nested);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Org-wide pattern: skills/org-wide/<name>.md
      results.push({ absPath: fullPath, name: basename(entry.name, '.md') });
    }
  }

  return results;
}

async function main() {
  console.log(`Syncing skills from ${SKILLS_DIR} for org_id="${ORG_ID}"...\n`);

  const files = await findSkillFiles(SKILLS_DIR);
  let synced = 0;
  let skipped = 0;

  for (const { absPath, name } of files) {
    const content = await readFile(absPath, 'utf-8');
    const relPath = relative(MONOREPO_ROOT, absPath);
    const meta = parseMetadata(content, relPath, name);

    if (!meta) {
      skipped++;
      continue;
    }

    const { error } = await db
      .from('skill_index')
      .upsert({
        org_id: ORG_ID,
        name: meta.name,
        description: meta.description,
        scope: meta.scope,
        role: meta.role,
        status: meta.status,
        trigger_tags: meta.tags,
        file_path: meta.filePath,
      }, { onConflict: 'org_id,name' })
      .select()
      .single();

    if (error) {
      console.error(`  FAILED ${meta.name}: ${error.message}`);
      skipped++;
    } else {
      console.log(`  Synced: ${meta.name} (${meta.scope}${meta.role ? '/' + meta.role : ''})`);
      synced++;
    }
  }

  console.log(`\nDone. Synced: ${synced}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Skill sync failed:', err);
  process.exit(1);
});
