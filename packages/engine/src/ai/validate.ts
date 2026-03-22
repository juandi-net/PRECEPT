import { z } from 'zod';
import { invokeAgent } from './invoke.js';
import type { AgentResponse, InvokeAgentOptions } from './invoke.js';

export class SchemaValidationError extends Error {
  constructor(
    public readonly label: string,
    public readonly firstError: z.ZodError,
    public readonly retryError?: z.ZodError,
  ) {
    const msg = retryError
      ? `${label}: validation failed after retry. First: ${firstError.message}. Retry: ${retryError.message}`
      : `${label}: validation failed. ${firstError.message}`;
    super(msg);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Invoke an agent and validate the response against a Zod schema.
 * On validation failure, retries once with error feedback in the prompt.
 * On second failure, throws SchemaValidationError.
 *
 * Callers handle SchemaValidationError per their failure policy:
 * - Planning/Worker: throw → FAILED + escalation
 * - Review/Judge: catch → conservative default verdict
 * - Advisor: catch → skip review
 */
export async function invokeAndValidate<T>(
  agentId: string,
  options: InvokeAgentOptions,
  schema: z.ZodType<T>,
  label: string,
): Promise<{ response: AgentResponse; data: T }> {
  const response = await invokeAgent(agentId, options);
  const result = schema.safeParse(response.parsed);
  if (result.success) return { response, data: result.data };

  // Retry with validation error feedback
  console.warn(`[ai] ${label}: validation failed, retrying. Error: ${result.error.message}`);
  const retryOptions: InvokeAgentOptions = {
    ...options,
    messages: [
      ...options.messages,
      { role: 'assistant', content: response.content },
      {
        role: 'user',
        content: `Your response was not valid JSON matching the expected schema. Error: ${result.error.message}. Please try again with valid JSON.`,
      },
    ],
  };

  const retryResponse = await invokeAgent(agentId, retryOptions);
  const retryResult = schema.safeParse(retryResponse.parsed);
  if (retryResult.success) return { response: retryResponse, data: retryResult.data };

  throw new SchemaValidationError(label, result.error, retryResult.error);
}
