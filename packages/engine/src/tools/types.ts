import type { ToolDefinition } from '../ai/invoke.js';

export const BASH_EXECUTE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'bash_execute',
    description: 'Execute a bash command or script in the task workspace. Use this to run skill scripts.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
      },
      required: ['command'],
    },
  },
};

export const LOAD_SKILL_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'load_skill',
    description: 'Load the full procedure for a skill by name. Call this before starting work if a skill is relevant to your task.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The skill name from the available skills index',
        },
      },
      required: ['name'],
    },
  },
};
