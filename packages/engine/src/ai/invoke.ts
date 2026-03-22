import OpenAI from 'openai';
import { ai, MODELS } from './client.js';
import { logEvent } from '../db/audit.js';
import type { AuditEventType } from '@precept/shared';

// Client cache for endpoint overrides
const clientCache = new Map<string, OpenAI>();

function getClient(endpoint?: string | null): OpenAI {
  if (!endpoint) return ai;

  let client = clientCache.get(endpoint);
  if (!client) {
    client = new OpenAI({
      baseURL: endpoint,
      apiKey: process.env.CLIPROXY_API_KEY ?? 'not-needed',
    });
    clientCache.set(endpoint, client);
  }
  return client;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<string>;

export interface InvokeAgentOptions {
  orgId: string;
  model: string;                  // 'opus' | 'sonnet' today, any model identifier via registry
  endpoint?: string | null;       // override default CLIProxy URL
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }>;
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolHandler?: ToolHandler;
  maxToolRounds?: number;
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

const MAX_TOOL_ROUNDS_DEFAULT = 30;

export async function invokeAgent(
  agentId: string,
  options: InvokeAgentOptions,
  retryDelays: number[] = RETRY_DELAYS
): Promise<AgentResponse> {
  // Resolve model: check MODELS map first, fall back to raw string (future model IDs)
  const modelId = (MODELS as Record<string, string>)[options.model] ?? options.model;
  const client = getClient(options.endpoint);
  const maxRounds = options.maxToolRounds ?? MAX_TOOL_ROUNDS_DEFAULT;
  let lastError: Error = new Error('No attempts made');

  for (let attempt = 0; attempt < retryDelays.length + 1; attempt++) {
    try {
      const startMs = Date.now();

      // Build conversation messages — mutable for tool loop
      const conversationMessages: Array<Record<string, unknown>> = [
        { role: 'system', content: options.systemPrompt },
        ...options.messages,
      ];

      // Aggregate usage across tool rounds
      const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let finalContent = '';
      let toolRounds = 0;

      for (let round = 0; round < maxRounds; round++) {
        const requestParams: Record<string, unknown> = {
          model: modelId,
          messages: conversationMessages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        };

        if (options.tools && options.tools.length > 0) {
          requestParams.tools = options.tools;
        }

        const response = await client.chat.completions.create(requestParams as any);
        const message = response.choices[0]?.message;

        totalUsage.promptTokens += response.usage?.prompt_tokens ?? 0;
        totalUsage.completionTokens += response.usage?.completion_tokens ?? 0;
        totalUsage.totalTokens += response.usage?.total_tokens ?? 0;

        // Check for tool calls
        const toolCalls = message?.tool_calls;
        if (toolCalls && toolCalls.length > 0 && options.toolHandler) {
          // Append the assistant's tool-call message
          conversationMessages.push({
            role: 'assistant',
            content: message.content ?? null,
            tool_calls: toolCalls,
          });

          // Execute each tool call and append results
          for (const tc of toolCalls) {
            if (tc.type !== 'function') continue;
            // Normalize: models sometimes prefix tool names with "proxy_"
            const rawName = tc.function.name;
            const toolName = rawName.startsWith('proxy_') ? rawName.slice(6) : rawName;
            if (toolName !== rawName) {
              console.warn(`[invoke] normalized tool name "${rawName}" → "${toolName}"`);
            }
            const args = JSON.parse(tc.function.arguments);
            let result: string;
            try {
              result = await options.toolHandler(toolName, args);
            } catch (toolErr) {
              const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
              console.error(`[invoke] tool "${toolName}" threw:`, errMsg);
              result = JSON.stringify({ error: errMsg });
            }
            conversationMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            });
          }
          toolRounds++;
          continue; // Next round
        }

        // No tool calls — final response
        finalContent = message?.content ?? '';
        break;
      }

      // If we exhausted all rounds without a final response
      if (finalContent === '' && toolRounds >= maxRounds) {
        throw new Error(`Agent ${agentId} exceeded maximum tool call rounds (${maxRounds})`);
      }

      const durationMs = Date.now() - startMs;

      let parsed: Record<string, unknown> | undefined;
      if (options.jsonMode) {
        parsed = extractJSON(finalContent);
      }

      // Fire-and-forget audit log
      logEvent(options.orgId, 'ai.call' as AuditEventType, agentId, {
        model: modelId,
        durationMs,
        tokens: totalUsage,
        jsonMode: options.jsonMode ?? false,
        parsed: parsed !== undefined,
        toolRounds,
      }, totalUsage.totalTokens);

      return { content: finalContent, parsed, usage: totalUsage, model: modelId, durationMs };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry deterministic failures (e.g. tool round exhaustion)
      if (lastError.message.includes('exceeded maximum tool call rounds')) {
        throw lastError;
      }

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
