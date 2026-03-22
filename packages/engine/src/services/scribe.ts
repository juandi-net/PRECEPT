import type { InternalMessage } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { SCRIBE_SYSTEM_PROMPT, SCRIBE_SYNTHESIS_PROMPT, buildScribeUserMessage } from '../ai/prompts/scribe.js';
import type { InitiativeWithTasks } from '../ai/prompts/scribe.js';
import { getRecentEvents } from '../db/audit.js';
import { getActiveInitiatives } from '../db/initiatives.js';
import { getRecentLessons } from '../db/decisions.js';
import { getTasksByInitiative } from '../db/tasks.js';
import { logMessage } from '../db/messages.js';
import { roleRegistry } from '../config/role-registry.js';

export type ScribeMode = 'compress' | 'synthesize';

export class ScribeService {
  async compressContext(orgId: string, mode: ScribeMode = 'compress'): Promise<InternalMessage> {
    const start = Date.now();
    console.log(`[scribe] starting context gathering (mode: ${mode})...`);

    const [auditEntries, initiatives, lessons] = await Promise.all([
      getRecentEvents(orgId, 50),
      getActiveInitiatives(orgId),
      getRecentLessons(orgId, 10),
    ]);

    // Fetch tasks per initiative and compute state counts
    const initiativesWithTasks: InitiativeWithTasks[] = await Promise.all(
      initiatives.map(async (i) => {
        const tasks = await getTasksByInitiative(i.id);
        const taskCounts: Record<string, number> = {};
        for (const t of tasks) {
          taskCounts[t.state] = (taskCounts[t.state] ?? 0) + 1;
        }
        return {
          name: i.name,
          status: i.status,
          phase_current: i.phase_current,
          taskCounts,
        };
      }),
    );

    const userMessage = buildScribeUserMessage(
      auditEntries.map((e) => ({
        event_type: e.event_type,
        agent_id: e.agent_id,
        metadata: e.metadata,
        created_at: e.created_at,
      })),
      initiativesWithTasks,
      lessons.map((l) => ({
        what_tried: l.whatTried,
        what_happened: l.whatHappened,
        what_learned: l.whatLearned,
      })),
    );

    const systemPrompt = mode === 'compress'
      ? SCRIBE_SYSTEM_PROMPT
      : SCRIBE_SYNTHESIS_PROMPT;

    const model = await roleRegistry.getModel(orgId, 'scribe');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'scribe');
    const response = await invokeAgent('Scribe-1', {
      orgId,
      model,
      endpoint,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
      jsonMode: true,
    });

    const message: InternalMessage = {
      id: crypto.randomUUID(),
      org_id: orgId,
      from_role: 'scribe',
      from_agent_id: 'Scribe-1',
      to_role: 'ceo',
      message_type: 'context_package',
      payload: response.parsed ?? {},
      created_at: new Date().toISOString(),
    };

    logMessage({
      org_id: orgId,
      from_role: 'scribe',
      from_agent_id: 'Scribe-1',
      to_role: 'ceo',
      message_type: 'context_package',
      payload: message.payload,
    });

    console.log(`[scribe] done (${((Date.now() - start) / 1000).toFixed(1)}s)`);
    return message;
  }

  /** Lightweight chat compression — summarize older messages into 2-3 sentences */
  async compressChat(orgId: string, messages: Array<{ role: string; content: string }>): Promise<string> {
    const model = await roleRegistry.getModel(orgId, 'scribe');
    const endpoint = await roleRegistry.getEndpoint(orgId, 'scribe');
    const transcript = messages.map(m =>
      `${m.role === 'owner' ? 'Owner' : 'CEO'}: ${m.content}`
    ).join('\n');

    const response = await invokeAgent('Scribe-1', {
      orgId,
      model,
      endpoint,
      systemPrompt: 'Summarize this conversation between an owner and their AI CEO in 2-3 sentences. Capture key decisions, action items, and outcomes. Be specific about what was discussed and decided. Do not use bullet points.',
      messages: [{ role: 'user', content: transcript }],
      temperature: 0.3,
    });

    return response.content;
  }
}
