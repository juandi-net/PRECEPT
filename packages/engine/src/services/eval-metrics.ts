import { db } from '../db/client.js';

/**
 * Compute weekly evaluation metrics from task_transitions.
 * Called as part of the Curator weekly batch cycle.
 */
export async function computeWeeklyMetrics(orgId: string, weekLabel: string): Promise<void> {
  // Get week boundaries from label (e.g., '2026-W10')
  const weekMatch = weekLabel.match(/^(\d{4})-W(\d{1,2})$/);
  if (!weekMatch) {
    console.error(`[eval-metrics] invalid week label: ${weekLabel}`);
    return;
  }

  const year = parseInt(weekMatch[1]);
  const week = parseInt(weekMatch[2]);
  const weekStart = getWeekStartDate(year, week);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Query task transitions for the week
  const { data: transitions, error } = await db
    .from('task_transitions')
    .select('task_id, from_state, to_state, agent_id, reason, created_at')
    .eq('org_id', orgId)
    .gte('created_at', weekStart.toISOString())
    .lt('created_at', weekEnd.toISOString());

  if (error) {
    console.error(`[eval-metrics] failed to query transitions: ${error.message}`);
    return;
  }

  if (!transitions || transitions.length === 0) return;

  // Count reviewer metrics
  let reviewerTasks = 0;
  let reviewerPolish = 0;
  let reviewerPass = 0;

  // Count judge metrics
  let judgeTasks = 0;
  let judgeAccept = 0;
  let judgeRevise = 0;
  let judgeEscalate = 0;

  // Track per-task verdicts for reviewer miss detection
  const taskVerdicts = new Map<string, { reviewerPassed: boolean; judgeRevised: boolean }>();

  for (const t of transitions) {
    // Reviewer: REVIEW → POLISH means reviewer caught something
    if (t.from_state === 'REVIEW' && t.to_state === 'POLISH') {
      reviewerTasks++;
      reviewerPolish++;
      const entry = taskVerdicts.get(t.task_id) ?? { reviewerPassed: false, judgeRevised: false };
      taskVerdicts.set(t.task_id, entry);
    }
    // Reviewer: REVIEW → JUDGMENT means reviewer passed (GOOD/EXCELLENT)
    if (t.from_state === 'REVIEW' && t.to_state === 'JUDGMENT') {
      reviewerTasks++;
      reviewerPass++;
      const entry = taskVerdicts.get(t.task_id) ?? { reviewerPassed: false, judgeRevised: false };
      entry.reviewerPassed = true;
      taskVerdicts.set(t.task_id, entry);
    }
    // Judge: JUDGMENT → ACCEPTED
    if (t.from_state === 'JUDGMENT' && t.to_state === 'ACCEPTED') {
      judgeTasks++;
      judgeAccept++;
    }
    // Judge: JUDGMENT → REVISION
    if (t.from_state === 'JUDGMENT' && t.to_state === 'REVISION') {
      judgeTasks++;
      judgeRevise++;
      const entry = taskVerdicts.get(t.task_id) ?? { reviewerPassed: false, judgeRevised: false };
      entry.judgeRevised = true;
      taskVerdicts.set(t.task_id, entry);
    }
    // Judge: JUDGMENT → ESCALATED
    if (t.from_state === 'JUDGMENT' && t.to_state === 'ESCALATED') {
      judgeTasks++;
      judgeEscalate++;
    }
  }

  // Reviewer miss: Reviewer passed (GOOD) but Judge revised
  let reviewerMiss = 0;
  for (const [, v] of taskVerdicts) {
    if (v.reviewerPassed && v.judgeRevised) reviewerMiss++;
  }

  // Upsert into evaluation_metrics
  const { error: upsertError } = await db
    .from('evaluation_metrics')
    .upsert({
      org_id: orgId,
      period: weekLabel,
      reviewer_tasks: reviewerTasks,
      reviewer_polish: reviewerPolish,
      reviewer_pass: reviewerPass,
      judge_tasks: judgeTasks,
      judge_accept: judgeAccept,
      judge_revise: judgeRevise,
      judge_escalate: judgeEscalate,
      reviewer_miss: reviewerMiss,
    }, { onConflict: 'org_id,period' });

  if (upsertError) {
    console.error(`[eval-metrics] upsert failed: ${upsertError.message}`);
    return;
  }

  console.log(`[eval-metrics] ${weekLabel}: reviewer ${reviewerTasks} tasks (${reviewerPolish} polish, ${reviewerPass} pass), judge ${judgeTasks} tasks (${judgeAccept} accept, ${judgeRevise} revise, ${judgeEscalate} escalate), reviewer miss: ${reviewerMiss}`);
}

/** Get ISO week start date (Monday) for a given year and ISO week number. */
function getWeekStartDate(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Monday = 1 ... Sunday = 7
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  const result = new Date(mondayOfWeek1);
  result.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
  return result;
}

/** Get current ISO week label (e.g., '2026-W10'). */
export function getCurrentWeekLabel(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
  const dayOfWeek = jan4.getDay() || 7;
  const weekNum = Math.ceil((dayOfYear + dayOfWeek - 1) / 7);
  return `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}
