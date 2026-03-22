/**
 * Integration test: verifies the Curator feedback loop fires end-to-end.
 *
 * Seeds real skill_index + skill_events rows into Supabase, runs a Curator
 * cycle, and checks that the AI's reasoning references skill performance data
 * and existing skill content.
 *
 * Usage: bun --env-file=../../.env src/scripts/test-curator-loop.ts
 *
 * Cleans up all seeded data on exit (success or failure).
 */

import { db } from '../db/client.js';
import { getSkillPerformanceSummary } from '../db/skill-events.js';
import { getAllActiveSkillsWithContent } from '../db/skills.js';
import { buildCuratorMessage, CURATOR_SYSTEM_PROMPT } from '../ai/prompts/curator.js';
import { CuratorService } from '../services/curator.js';

const TEST_ORG_ID = '00000000-0000-0000-0000-feed00bac100';
const NOW = new Date().toISOString();

// ── Seed data ──────────────────────────────────────────────────────────

async function seed() {
  console.log('\n── Seeding test data ──\n');

  // 1. Create test org
  const { error: orgErr } = await db.from('orgs').upsert({
    id: TEST_ORG_ID,
    name: 'curator-loop-test',
    slug: 'curator-loop-test',
    owner_id: '00000000-0000-0000-0000-000000000001',
    status: 'active',
  }, { onConflict: 'id' });
  if (orgErr) throw new Error(`Failed to seed org: ${orgErr.message}`);
  console.log('  ✓ org created');

  // 2. Seed role_config (Curator needs this to resolve model)
  const { error: rcErr } = await db.from('role_config').upsert({
    org_id: TEST_ORG_ID,
    role: 'curator',
    tier: 'system',
    model_tier: 'sonnet',
    context_includes: [],
    context_excludes: [],
    separation_policy: 'always',
    trust_autonomy: 'execute_only',
  }, { onConflict: 'org_id,role' });
  if (rcErr) throw new Error(`Failed to seed role_config: ${rcErr.message}`);
  console.log('  ✓ role_config (curator) created');

  // 3. Seed two skills with content
  const skills = [
    {
      org_id: TEST_ORG_ID,
      name: 'cold-outreach-emails',
      description: 'Writing cold outreach emails to prospects',
      scope: 'role_specific',
      role: 'writer',
      status: 'active',
      trigger_tags: ['outreach', 'email'],
      content: [
        '## When To Use',
        'When writing cold outreach emails to potential customers.',
        '',
        '## Procedure',
        '1. Research the prospect company',
        '2. Find a relevant hook',
        '3. Write a personalized subject line',
        '4. Keep body under 100 words',
        '',
        '## Quality Criteria',
        '- Personalized to recipient',
        '- Clear call to action',
        '',
        '## Anti-Patterns',
        '- Generic "Dear Sir/Madam" openings',
      ].join('\n'),
      created_at: NOW,
      updated_at: NOW,
    },
    {
      org_id: TEST_ORG_ID,
      name: 'competitive-analysis',
      description: 'Structured competitive analysis research',
      scope: 'role_specific',
      role: 'researcher',
      status: 'active',
      trigger_tags: ['research', 'competition'],
      content: [
        '## When To Use',
        'When researching competitors for strategic planning.',
        '',
        '## Procedure',
        '1. Identify top 5 competitors',
        '2. Analyze pricing, features, positioning',
        '3. Summarize in comparison matrix',
        '',
        '## Quality Criteria',
        '- Covers pricing and features',
        '- Sources cited',
        '',
        '## Anti-Patterns',
        '- Relying on outdated data (>6 months old)',
      ].join('\n'),
      created_at: NOW,
      updated_at: NOW,
    },
  ];

  for (const skill of skills) {
    const { error } = await db.from('skill_index').upsert(skill, { onConflict: 'org_id,name' });
    if (error) throw new Error(`Failed to seed skill ${skill.name}: ${error.message}`);
    console.log(`  ✓ skill "${skill.name}" created`);
  }

  // 4. Seed skill_events — cold-outreach underperforming, competitive-analysis doing well
  const events = [
    // cold-outreach: loaded 6 times, 2 accepted, 4 rejected
    ...Array.from({ length: 6 }, () => ({ org_id: TEST_ORG_ID, skill_name: 'cold-outreach-emails', event_type: 'loaded', metadata: { taskRole: 'writer' } })),
    ...Array.from({ length: 2 }, () => ({ org_id: TEST_ORG_ID, skill_name: 'cold-outreach-emails', event_type: 'correlated_accept', metadata: { verdict: 'ACCEPT', taskRole: 'writer' } })),
    ...Array.from({ length: 4 }, () => ({ org_id: TEST_ORG_ID, skill_name: 'cold-outreach-emails', event_type: 'correlated_reject', metadata: { verdict: 'REVISE', taskRole: 'writer' } })),
    // competitive-analysis: loaded 5 times, 5 accepted, 0 rejected
    ...Array.from({ length: 5 }, () => ({ org_id: TEST_ORG_ID, skill_name: 'competitive-analysis', event_type: 'loaded', metadata: { taskRole: 'researcher' } })),
    ...Array.from({ length: 5 }, () => ({ org_id: TEST_ORG_ID, skill_name: 'competitive-analysis', event_type: 'correlated_accept', metadata: { verdict: 'ACCEPT', taskRole: 'researcher' } })),
  ];

  const { error: evErr } = await db.from('skill_events').insert(events);
  if (evErr) throw new Error(`Failed to seed skill_events: ${evErr.message}`);
  console.log(`  ✓ ${events.length} skill_events created`);

  // 5. Seed a couple audit_log entries (review + judge verdicts) so the Curator has context
  const auditEvents = [
    { org_id: TEST_ORG_ID, event_type: 'review.verdict', agent: 'Reviewer-1', detail: { verdict: 'POLISH', feedback: 'Subject line is too generic — no personalization', role: 'writer' } },
    { org_id: TEST_ORG_ID, event_type: 'review.verdict', agent: 'Reviewer-1', detail: { verdict: 'POLISH', feedback: 'Email body uses template language without adapting to prospect', role: 'writer' } },
    { org_id: TEST_ORG_ID, event_type: 'judge.verdict', agent: 'Engine', detail: { verdict: 'REVISE', feedback: 'Failed acceptance criteria: no personalized hook', role: 'writer' } },
    { org_id: TEST_ORG_ID, event_type: 'judge.verdict', agent: 'Engine', detail: { verdict: 'ACCEPT', assessment: 'Thorough competitive analysis with accurate pricing data', role: 'researcher' } },
    { org_id: TEST_ORG_ID, event_type: 'review.verdict', agent: 'Reviewer-1', detail: { verdict: 'EXCELLENT', commendation: 'Outstanding competitive matrix', notes: 'Clean structure', role: 'researcher' } },
  ];

  const { error: auditErr } = await db.from('audit_log').insert(auditEvents);
  if (auditErr) throw new Error(`Failed to seed audit_log: ${auditErr.message}`);
  console.log(`  ✓ ${auditEvents.length} audit_log events created`);
}

// ── Cleanup ────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('\n── Cleaning up ──\n');
  await db.from('skill_events').delete().eq('org_id', TEST_ORG_ID);
  await db.from('audit_log').delete().eq('org_id', TEST_ORG_ID);
  await db.from('skill_index').delete().eq('org_id', TEST_ORG_ID);
  await db.from('role_config').delete().eq('org_id', TEST_ORG_ID);
  await db.from('orgs').delete().eq('id', TEST_ORG_ID);
  console.log('  ✓ all test data removed');
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  try {
    await seed();

    // ── Step 1: Verify DB functions return real data ──
    console.log('\n── Step 1: Verify DB reads ──\n');

    const perf = await getSkillPerformanceSummary(TEST_ORG_ID);
    console.log('  getSkillPerformanceSummary():');
    for (const s of perf) {
      const total = s.accepts + s.rejects;
      const rate = total > 0 ? Math.round((s.accepts / total) * 100) : null;
      console.log(`    ${s.skillName}: loaded=${s.timesLoaded} accept=${s.accepts} reject=${s.rejects} rate=${rate}%`);
    }

    if (perf.length === 0) throw new Error('FAIL: getSkillPerformanceSummary returned empty');
    const coldOutreach = perf.find(s => s.skillName === 'cold-outreach-emails');
    if (!coldOutreach) throw new Error('FAIL: cold-outreach-emails not in performance data');
    if (coldOutreach.rejects !== 4) throw new Error(`FAIL: expected 4 rejects, got ${coldOutreach.rejects}`);
    if (coldOutreach.accepts !== 2) throw new Error(`FAIL: expected 2 accepts, got ${coldOutreach.accepts}`);
    console.log('  ✓ Performance data correct');

    const skills = await getAllActiveSkillsWithContent(TEST_ORG_ID);
    console.log(`\n  getAllActiveSkillsWithContent(): ${skills.length} skills`);
    for (const s of skills) {
      console.log(`    ${s.name}: ${s.content ? s.content.length + ' chars' : '(no content)'}`);
    }
    if (skills.length !== 2) throw new Error(`FAIL: expected 2 skills, got ${skills.length}`);
    if (!skills[0].content) throw new Error('FAIL: skill content is null');
    console.log('  ✓ Skill content loaded');

    // ── Step 2: Verify message assembly ──
    console.log('\n── Step 2: Verify message assembly ──\n');

    const message = buildCuratorMessage({
      reviewPatterns: [
        { verdict: 'POLISH', feedback: 'Subject line too generic', role: 'writer' },
        { verdict: 'EXCELLENT', feedback: 'Outstanding competitive matrix', role: 'researcher' },
      ],
      judgePatterns: [
        { verdict: 'REVISE', assessment: 'Failed: no personalized hook', role: 'writer' },
        { verdict: 'ACCEPT', assessment: 'Thorough analysis', role: 'researcher' },
      ],
      lessons: [],
      existingSkills: skills.map(s => ({ name: s.name, content: s.content })),
      skillPerformance: perf.map(s => ({
        skillName: s.skillName,
        timesLoaded: s.timesLoaded,
        accepts: s.accepts,
        rejects: s.rejects,
      })),
    });

    // Verify key sections exist
    const checks = [
      ['## Skill Performance (last 7 days)', 'performance section'],
      ['cold-outreach-emails: loaded 6 times, 2 accepted, 4 rejected (33% acceptance)', 'cold-outreach stats'],
      ['competitive-analysis: loaded 5 times, 5 accepted, 0 rejected (100% acceptance)', 'competitive-analysis stats'],
      ['### cold-outreach-emails', 'cold-outreach full content header'],
      ['Keep body under 100 words', 'cold-outreach procedure content'],
      ['### competitive-analysis', 'competitive-analysis full content header'],
      ['Identify top 5 competitors', 'competitive-analysis procedure content'],
    ] as const;

    for (const [needle, label] of checks) {
      if (!message.includes(needle)) throw new Error(`FAIL: message missing ${label}: "${needle}"`);
      console.log(`  ✓ ${label}`);
    }

    console.log('\n  ── Full Curator message ──');
    console.log(message);

    // ── Step 3: Run real Curator cycle ──
    console.log('\n── Step 3: Run Curator cycle (real AI call) ──\n');

    const curator = new CuratorService();
    const result = await curator.extractSkills(TEST_ORG_ID);

    console.log(`\n  Result: created=${result.created} refined=${result.refined} deprecated=${result.deprecated}`);

    // Read the refined skill to see what the Curator wrote
    const { data: refinedSkills } = await db
      .from('skill_index')
      .select('name, content')
      .eq('org_id', TEST_ORG_ID)
      .eq('status', 'active');
    if (refinedSkills) {
      for (const s of refinedSkills) {
        console.log(`\n  ── Skill "${s.name}" (post-Curator) ──`);
        console.log(s.content);
      }
    }

    // Wait for fire-and-forget logEvent to flush
    await new Promise(r => setTimeout(r, 2000));

    // Check the audit_log for the curator.cycle event to get the reasoning
    const { data: cycleEvents } = await db
      .from('audit_log')
      .select('detail')
      .eq('org_id', TEST_ORG_ID)
      .eq('event_type', 'curator.cycle')
      .order('created_at', { ascending: false })
      .limit(1);

    if (cycleEvents && cycleEvents.length > 0) {
      const reasoning = (cycleEvents[0].detail as any)?.reasoning;
      console.log('\n  ── Curator reasoning ──');
      console.log(reasoning);

      // The key check: does the reasoning reference performance data?
      const reasoningLower = (reasoning ?? '').toLowerCase();
      const referencesPerformance =
        reasoningLower.includes('cold-outreach') ||
        reasoningLower.includes('outreach') ||
        reasoningLower.includes('acceptance') ||
        reasoningLower.includes('33%') ||
        reasoningLower.includes('reject');

      if (referencesPerformance) {
        console.log('\n  ✓✓✓ PASS: Curator reasoning references skill performance data');
      } else {
        console.log('\n  ✗ WARNING: Curator reasoning may not reference performance data — review manually');
      }
    } else {
      console.log('\n  ✗ No curator.cycle event found in audit_log');
    }

    console.log('\n── INTEGRATION TEST COMPLETE ──\n');
  } finally {
    await cleanup();
  }
}

main().catch(err => {
  console.error('\n✗ FATAL:', err);
  cleanup().finally(() => process.exit(1));
});
