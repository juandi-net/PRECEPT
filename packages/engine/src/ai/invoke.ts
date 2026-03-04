import { ai, MODELS } from './client.js';
import { logEvent } from '../db/audit.js';
import type { AuditEventType } from '@precept/shared';

export interface InvokeAgentOptions {
  orgId: string;
  model: 'opus' | 'sonnet';
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
}

export interface AgentResponse {
  content: string;
  parsed?: Record<string, unknown>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  durationMs: number;
}

export class AgentInvocationError extends Error {
  constructor(
    public readonly agentId: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(`Agent ${agentId} failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'AgentInvocationError';
  }
}

export const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

export async function invokeAgent(
  agentId: string,
  options: InvokeAgentOptions,
  retryDelays: number[] = RETRY_DELAYS
): Promise<AgentResponse> {
  const modelId = MODELS[options.model];
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt < retryDelays.length + 1; attempt++) {
    try {
      const startMs = Date.now();

      const response = await ai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system' as const, content: options.systemPrompt },
          ...options.messages,
        ],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      });

      const durationMs = Date.now() - startMs;
      const content = response.choices[0]?.message?.content ?? '';
      const usage = {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      };

      let parsed: Record<string, unknown> | undefined;
      if (options.jsonMode) {
        parsed = extractJSON(content);
      }

      // Fire-and-forget audit log
      logEvent(options.orgId, 'ai.call' as AuditEventType, agentId, {
        model: modelId,
        durationMs,
        tokens: usage,
        jsonMode: options.jsonMode ?? false,
        parsed: parsed !== undefined,
      }, usage.totalTokens);

      return { content, parsed, usage, model: modelId, durationMs };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retryDelays.length) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
  }

  throw new AgentInvocationError(agentId, retryDelays.length + 1, lastError);
}

/** 3-tier JSON extraction: strip fences → regex → undefined */
export function extractJSON(content: string): Record<string, unknown> | undefined {
  // Tier 1: strip markdown fences
  const stripped = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
  try {
    return JSON.parse(stripped);
  } catch { /* continue */ }

  // Tier 2: regex find first { ... }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch { /* continue */ }
  }

  return undefined;
}
