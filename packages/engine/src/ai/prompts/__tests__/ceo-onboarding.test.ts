import { describe, it, expect } from 'vitest';
import { buildMessages } from '../ceo-onboarding.js';
import type { ConversationMessage, ExtractionTracker, PreceptsDraft } from '@precept/shared';

describe('buildMessages', () => {
  const tracker: ExtractionTracker = {
    coveredTopics: ['identity'],
    currentPhase: 2,
    fieldsExtracted: ['identity'],
    fieldsRemaining: ['product_service', 'stage', 'success_definition', 'resources', 'constraints', 'competitive_landscape', 'history', 'active_priorities', 'data_policy'],
    activeThread: 'product_overview',
  };

  const draft: PreceptsDraft = {
    identity: { name: 'identity', content: 'A SaaS company', state: 'confirmed', notes: null },
    product_service: null, stage: null, success_definition: null, resources: null,
    constraints: null, competitive_landscape: null, history: null,
    active_priorities: null, data_policy: null,
  };

  it('uses rawResponse for CEO messages when available', () => {
    const rawResponse = JSON.stringify({
      message: 'Tell me about your product.',
      updatedTracker: { ...tracker, currentPhase: 1, fieldsExtracted: ['identity'] },
      updatedFields: {
        identity: { name: 'identity', content: 'A SaaS company', state: 'confirmed', notes: null },
      },
    });

    const conversation: ConversationMessage[] = [
      { role: 'ceo', content: 'Tell me about your product.', timestamp: '2026-03-02T00:00:00Z', rawResponse },
      { role: 'owner', content: 'We sell widgets.', timestamp: '2026-03-02T00:01:00Z' },
    ];

    const messages = buildMessages(conversation, tracker, draft);

    // The assistant message should use the raw response, not a reconstructed one
    const assistantMsg = messages.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();

    const parsed = JSON.parse(assistantMsg!.content);
    expect(parsed.updatedFields).toHaveProperty('identity');
    expect(parsed.updatedFields.identity.content).toBe('A SaaS company');
  });

  it('falls back to reconstructed response when rawResponse is absent', () => {
    const conversation: ConversationMessage[] = [
      { role: 'ceo', content: 'Tell me about your product.', timestamp: '2026-03-02T00:00:00Z' },
      { role: 'owner', content: 'We sell widgets.', timestamp: '2026-03-02T00:01:00Z' },
    ];

    const messages = buildMessages(conversation, tracker, draft);
    const assistantMsg = messages.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();

    const parsed = JSON.parse(assistantMsg!.content);
    // Fallback still uses empty updatedFields (backward compat)
    expect(parsed.updatedFields).toEqual({});
  });
});
