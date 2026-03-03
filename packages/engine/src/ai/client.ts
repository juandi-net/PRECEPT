import OpenAI from 'openai';

const baseURL = process.env.CLIPROXY_BASE_URL;
const apiKey = process.env.CLIPROXY_API_KEY;

if (!baseURL || !apiKey) {
  throw new Error('Missing CLIPROXY_BASE_URL or CLIPROXY_API_KEY');
}

export const ai = new OpenAI({ baseURL, apiKey });

export const MODELS = {
  opus: process.env.CLIPROXY_MODEL_OPUS || 'claude-opus-4-6',
  sonnet: process.env.CLIPROXY_MODEL_SONNET || 'claude-sonnet-4-5-20250929',
} as const;
