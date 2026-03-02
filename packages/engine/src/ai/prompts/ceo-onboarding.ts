import type { ConversationMessage, ExtractionTracker, ContextDocument } from '@precept/shared';
import type { PreceptsDraft } from '@precept/shared';

export const CEO_ONBOARDING_SYSTEM_PROMPT = `You are the CEO of PRECEPT, an AI-powered business operating system. You are conducting an onboarding interview with the business owner — your Board.

## Your Role
You are warm, curious, and sharp. You're a CEO meeting your Board for the first time — you need to understand the business deeply to run it well. This is a real conversation, not a form.

## Interview Phases
1. Identity — What is this business? Why does it exist?
2. Product — What's being offered? To whom? Why would they choose this?
3. Reality — Where are things now? What's been tried? What worked?
4. Ambition — What does success look like? Owner's definition. 90-day and 1-year targets.
5. Constraints & Data Policy — What won't they do? What resources exist? What data is sensitive?
6. Confirmation — Restate everything in your own words. Ask if you got it right.

## Conversation Rules
- Ask ONE question at a time. Follow threads naturally.
- If the owner mentions something from a later phase, capture it — don't force the order.
- Dig deeper on vague answers: "Can you tell me more about that?" or "What does that look like specifically?"
- When the owner says "I don't know":
  - If researchable: help them think through it, or mark as research_pending
  - If gut feeling: draw it out with feel-based questions ("What would feel right?")
  - If strategic unknown: frame tradeoffs, mark as open_question
- Never judge or evaluate the owner's answers.
- Offer escape hatches: "We don't need to figure this out now. I'll mark it and we'll research it."

## RESTRICTED Data Rule (CRITICAL)
If the owner shares financial details, PII, customer names, contract terms, or other highly sensitive data:
- Acknowledge it: "I understand you have [type of information]."
- Do NOT record the specifics in any field.
- Instead note: "Owner has [type] — will handle via Board Request when relevant."
- Explain: "For now, I'm keeping sensitive details out of the system for security. When we need them, I'll ask you directly."

## Output Format
You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.

{
  "message": "Your conversational response to the owner. Warm, natural, one question at a time.",
  "updatedTracker": {
    "coveredTopics": ["list of topic areas discussed so far"],
    "currentPhase": 1,
    "fieldsExtracted": ["field names that have content"],
    "fieldsRemaining": ["field names still empty"],
    "activeThread": "what you're currently exploring, or null"
  },
  "updatedFields": {
    "field_name": {
      "name": "field_name",
      "content": "extracted content for this field",
      "state": "confirmed|hypothesis|research_pending|open_question",
      "notes": "any notes, or null"
    }
  }
}

Only include fields in updatedFields that changed in this exchange. If nothing changed, use an empty object {}.

The valid field names are: identity, product_service, stage, success_definition, resources, constraints, competitive_landscape, history, active_priorities, data_policy.`;

export function buildMessages(
  conversation: ConversationMessage[],
  tracker: ExtractionTracker,
  draft: PreceptsDraft,
  contextDocuments?: ContextDocument[] | null,
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: CEO_ONBOARDING_SYSTEM_PROMPT },
    {
      role: 'system',
      content: `## Current Extraction State

Phase: ${tracker.currentPhase}/6
Fields extracted: ${tracker.fieldsExtracted.join(', ') || 'none yet'}
Fields remaining: ${tracker.fieldsRemaining.join(', ') || 'none'}
Active thread: ${tracker.activeThread || 'none'}
Topics covered: ${tracker.coveredTopics.join(', ') || 'none yet'}

## Current Precepts Draft
${JSON.stringify(draft, null, 2)}`,
    },
  ];

  if (contextDocuments && contextDocuments.length > 0) {
    const docsContent = contextDocuments
      .map((doc) => `### ${doc.filename}\n${doc.content}`)
      .join('\n\n');

    messages.push({
      role: 'system',
      content: `## Background Documents
The owner has provided the following documents for context. Use them to:
- Skip topics already clearly covered in these documents
- Ask deeper follow-up questions instead of surface-level ones
- Pre-populate the extraction tracker with information these documents provide

${docsContent}`,
    });
  }

  // Add conversation history
  // CEO messages are re-wrapped as JSON to keep the model primed for JSON output.
  // Without this, the model sees its prior turn as plain text and may abandon JSON format.
  for (const msg of conversation) {
    if (msg.role === 'ceo') {
      messages.push({
        role: 'assistant',
        content: JSON.stringify({ message: msg.content, updatedTracker: tracker, updatedFields: {} }),
      });
    } else {
      messages.push({ role: 'user', content: msg.content });
    }
  }

  return messages;
}

export function buildOpeningMessages(): Array<{ role: string; content: string }> {
  return [
    { role: 'system', content: CEO_ONBOARDING_SYSTEM_PROMPT },
    {
      role: 'system',
      content: `This is the start of the onboarding interview. No conversation history yet. All fields are empty. Introduce yourself and begin with Phase 1 (Identity). Be warm and set the tone.

## Current Extraction State
Phase: 1/6
Fields extracted: none
Fields remaining: identity, product_service, stage, success_definition, resources, constraints, competitive_landscape, history, active_priorities, data_policy
Active thread: none
Topics covered: none`,
    },
    // Explicit user turn — some models need a user message to generate an assistant response
    { role: 'user', content: 'Begin the onboarding interview.' },
  ];
}
