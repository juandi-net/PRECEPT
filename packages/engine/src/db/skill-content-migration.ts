/**
 * One-shot migration script: reads all active skill files from disk
 * and writes their content into the skill_index.content column.
 *
 * Usage: npx tsx packages/engine/src/db/skill-content-migration.ts
 *
 * Prerequisites: migration 00032_skill_content.sql must be applied first.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = join(__dirname, '..', '..', '..', '..');

interface SkillRow {
  id: string;
  name: string;
  file_path: string;
}

function resolveSkillMdPath(filePath: string): string {
  const fullPath = join(MONOREPO_ROOT, filePath);
  if (filePath.endsWith('.md')) return fullPath;
  if (filePath.endsWith('/')) return join(fullPath, 'SKILL.md');
  return join(fullPath, 'SKILL.md');
}

/**
 * For skill directories with subdirectories (references/, templates/),
 * read all files and append them to the main content.
 */
async function inlineAuxiliaryFiles(skillDirPath: string): Promise<string> {
  let inlined = '';

  let entries;
  try {
    entries = await readdir(skillDirPath, { withFileTypes: true });
  } catch {
    return inlined;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subdir = entry.name;
    if (subdir === 'scripts') continue;

    const subdirPath = join(skillDirPath, subdir);
    const files = await readdir(subdirPath);

    for (const file of files.sort()) {
      const filePath = join(subdirPath, file);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;

      const fileContent = await readFile(filePath, 'utf-8');
      const heading = subdir === 'references' ? 'Reference' : 'Template';
      inlined += `\n\n## ${heading}: ${file}\n\n${fileContent}`;
    }
  }

  return inlined;
}

async function main() {
  console.log('Starting skill content migration...\n');

  const { data: skills, error } = await db
    .from('skill_index')
    .select('id, name, file_path')
    .eq('status', 'active')
    .not('file_path', 'is', null);

  if (error) {
    console.error(`Failed to fetch skills: ${error.message}`);
    process.exit(1);
  }

  if (!skills || skills.length === 0) {
    console.log('No active skills with file_path found.');
    process.exit(0);
  }

  console.log(`Found ${skills.length} active skills to migrate.\n`);

  let migrated = 0;
  let failed = 0;

  for (const skill of skills as SkillRow[]) {
    try {
      const skillMdPath = resolveSkillMdPath(skill.file_path);
      let content = await readFile(skillMdPath, 'utf-8');

      const skillDir = skill.file_path.endsWith('.md')
        ? null
        : join(MONOREPO_ROOT, skill.file_path.replace(/\/$/, ''));

      if (skillDir) {
        const auxiliary = await inlineAuxiliaryFiles(skillDir);
        if (auxiliary) {
          content += auxiliary;
          console.log(`  Inlined auxiliary files for "${skill.name}"`);
        }
      }

      const { error: updateError } = await db
        .from('skill_index')
        .update({ content })
        .eq('id', skill.id);

      if (updateError) {
        console.error(`  FAILED "${skill.name}": ${updateError.message}`);
        failed++;
      } else {
        console.log(`  Migrated: "${skill.name}" (${content.length} chars)`);
        migrated++;
      }
    } catch (err) {
      console.error(`  FAILED "${skill.name}": ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${failed} failed.\n`);

  const { data: missing, error: verifyError } = await db
    .from('skill_index')
    .select('name')
    .eq('status', 'active')
    .is('content', null);

  if (verifyError) {
    console.error(`Verification query failed: ${verifyError.message}`);
    process.exit(1);
  }

  if (missing && missing.length > 0) {
    console.error(`VERIFICATION FAILED: ${missing.length} active skill(s) still have NULL content:`);
    for (const s of missing) {
      console.error(`  - ${s.name}`);
    }
    process.exit(1);
  }

  console.log('VERIFICATION PASSED: all active skills have content populated.');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
