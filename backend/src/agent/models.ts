/**
 * Shared AI provider/model resolver used by every Operari surface
 * that calls Vercel AI SDK directly. Centralised here so a future
 * change to the env-var contract or default model lands in one
 * place — without this, the orchestrator and ad-hoc routes
 * (ai-filter, runbook-assist, …) drift their defaults independently.
 *
 * Env contract:
 *   AI_MODEL_PROVIDER  "anthropic" (default) | "openai"
 *   AI_MODEL_NAME      provider-specific model id; defaults to
 *                      claude-sonnet-4-6 for anthropic.
 *
 * Returning the SDK's model object directly keeps callers free to
 * pick `streamText` / `generateText` / `generateObject` without
 * this module imposing a shape.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export function resolveAiModel() {
  const provider = process.env.AI_MODEL_PROVIDER ?? 'anthropic';
  const modelName = process.env.AI_MODEL_NAME ?? 'claude-sonnet-4-6';
  if (provider === 'openai') {
    return openai(modelName);
  }
  return anthropic(modelName);
}
