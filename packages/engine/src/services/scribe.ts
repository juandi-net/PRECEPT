import type { InternalMessage } from '@precept/shared';
import { invokeAgent } from '../ai/invoke.js';
import { SCRIBE_SYSTEM_PROMPT, buildScribeUserMessage } from '../ai/prompts/scribe.js';
import { getRecentEvents } from '../db/audit.js';
import { getActiveInitiatives } from '../db/initiatives.js';
import { getRecentLessons } from '../db/decisions.js';
import { logMessage } from '../db/messages.js';

export class ScribeService {
  async compressContext(orgId: string): Promise<InternalMessage> {
    const start = Date.now();
    console.log('[scribe] starting context gathering...');

    const [auditEntries, initiatives, lessons] = await Promise.all([
      getRecentEvents(orgId, 50),
      getActiveInitiatives(orgId),
      getRecentLessons(orgId, 10),
    ]);

    const userMessage = buildScribeUserMessage(
      auditEntries.map((e) => ({
        event_type: e.event_type,
        agent_id: e.agent_id,
        metadata: e.metadata,
        created_at: e.created_at,
      })),
      initiatives.map((i) => ({
        name: i.name,
        status: i.status,
        phase_current: i.phase_current,
      })),
      lessons.map((l) => ({
        what_tried: l.whatTried,
        what_happened: l.whatHappened,
        what_learned: l.whatLearned,
      })),
    );

    const response = await invokeAgent('Scribe-1', {
      orgId,
      model: 'sonnet',
      systemPrompt: SCRIBE_SYSTEM_PROMPT,
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
}
