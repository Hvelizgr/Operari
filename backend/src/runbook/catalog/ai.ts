import Anthropic from '@anthropic-ai/sdk';

import { blockedTarget, guardedFetch } from '../../security/ssrf-guard';
import {
  type CatalogNode,
  type CredentialInfo,
  fail,
  MAIN,
  ok,
  StepInputError,
  type StepTools,
} from './define';

/**
 * AI providers are credentials the user adds in Settings; nothing is
 * hardcoded. `ai.anthropic` goes through the official Anthropic SDK,
 * `ai.openai` and `ai.openai-compatible` through the Chat Completions
 * HTTP API that OpenAI, Ollama, OpenRouter, Groq, Mistral, DeepSeek,
 * Gemini and most self-hosted servers speak.
 */
export const AI_PROVIDER_KINDS = ['ai.anthropic', 'ai.openai', 'ai.openai-compatible'] as const;

const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

// Server-side `fallbacks: "default"` retries a safety decline on the model
// Anthropic recommends; only these models accept it.
const FALLBACK_MODELS = new Set([
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-fable-5-1',
  'claude-sonnet-5-5',
]);

export interface ModelRequest {
  system?: string;
  prompt: string;
  maxTokens: number;
  json: boolean;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  model?: string;
}

export interface ModelReply {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

function metaString(cred: CredentialInfo, key: string): string {
  const v = cred.metadata[key];
  return typeof v === 'string' ? v.trim() : '';
}

async function callAnthropic(cred: CredentialInfo, req: ModelRequest): Promise<ModelReply> {
  const baseURL = metaString(cred, 'baseUrl') || undefined;
  if (baseURL) {
    const blocked = await blockedTarget('url', baseURL);
    if (blocked) throw new StepInputError(blocked);
  }
  const model = req.model || metaString(cred, 'defaultModel') || DEFAULT_ANTHROPIC_MODEL;
  const client = new Anthropic({
    apiKey: cred.secret,
    ...(baseURL ? { baseURL } : {}),
    maxRetries: 2,
  });
  const system = [req.system, req.json ? 'Reply with a single JSON value and nothing else.' : '']
    .filter(Boolean)
    .join('\n\n');
  const withFallback = FALLBACK_MODELS.has(model) && !baseURL;
  const response = await client.beta.messages.create({
    model,
    max_tokens: req.maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: req.prompt }],
    ...(req.effort ? { output_config: { effort: req.effort } } : {}),
    ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
  });
  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category ?? 'unspecified';
    throw new Error(`the model declined the request (category: ${category})`);
  }
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map(b => b.text)
    .join('');
  return {
    text,
    model: response.model,
    inputTokens: response.usage.input_tokens ?? null,
    outputTokens: response.usage.output_tokens ?? null,
  };
}

async function callChatCompletions(
  cred: CredentialInfo,
  req: ModelRequest,
  httpFetch: typeof fetch
): Promise<ModelReply> {
  const isOpenAI = cred.provider === 'ai.openai';
  const base = (
    metaString(cred, 'baseUrl') || (isOpenAI ? 'https://api.openai.com/v1' : '')
  ).replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) {
    throw new StepInputError('this AI provider needs a base URL (Settings → Credentials)');
  }
  const model = req.model || metaString(cred, 'defaultModel');
  if (!model)
    throw new StepInputError('choose a model here or set a default model on the provider');
  const messages = [
    ...(req.system || req.json
      ? [
          {
            role: 'system',
            content: [
              req.system,
              req.json ? 'Reply with a single JSON value and nothing else.' : '',
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        ]
      : []),
    { role: 'user', content: req.prompt },
  ];
  const res = await guardedFetch(httpFetch, `${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cred.secret}` },
    body: JSON.stringify({
      model,
      messages,
      // OpenAI renamed the limit; compatible servers still read max_tokens.
      ...(isOpenAI ? { max_completion_tokens: req.maxTokens } : { max_tokens: req.maxTokens }),
      ...(req.json && isOpenAI ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  const raw = await res.text();
  let body: {
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
    error?: { message?: string };
  } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    // non-JSON error page
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${body.error?.message ?? raw.slice(0, 300)}`);
  const message = body.choices?.[0]?.message;
  if (message?.refusal) throw new Error(`the model declined the request: ${message.refusal}`);
  return {
    text: message?.content ?? '',
    model: body.model ?? model,
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
  };
}

export async function callModel(
  cred: CredentialInfo,
  req: ModelRequest,
  t: StepTools
): Promise<ModelReply> {
  if (cred.provider === 'ai.anthropic') return callAnthropic(cred, req);
  if (cred.provider === 'ai.openai' || cred.provider === 'ai.openai-compatible') {
    return callChatCompletions(cred, req, t.fetch);
  }
  throw new StepInputError(`"${cred.provider}" is not an AI provider credential`);
}

/** Pull a JSON value out of a reply, tolerating a ```json fence around it. */
export function parseJsonReply(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error(`the model did not return valid JSON: ${candidate.slice(0, 200)}`);
  }
}

const providerField = {
  name: 'provider',
  displayName: 'AI provider',
  type: 'secret' as const,
  required: true,
  description: 'Add providers in Settings → Credentials → AI providers.',
  typeOptions: { provider: 'ai' },
};

const modelField = {
  name: 'model',
  displayName: 'Model',
  type: 'string' as const,
  description: "Leave empty to use the provider's default model.",
};

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'ai',
  icon,
  color: 'bg-fuchsia-600',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

export const AI_NODES: CatalogNode[] = [
  {
    ...meta(
      'ai.prompt',
      'Sparkles',
      ['AI prompt', 'Prompt de IA'],
      [
        'Ask a model you configured: summarize, classify, extract or draft text',
        'Preguntar a un modelo que configuraste: resumir, clasificar, extraer o redactar',
      ]
    ),
    properties: [
      providerField,
      modelField,
      {
        name: 'system',
        displayName: 'Instructions',
        type: 'string',
        description: 'How the model should behave (system prompt).',
        typeOptions: { rows: 3, expression: true },
      },
      {
        name: 'prompt',
        displayName: 'Prompt',
        type: 'string',
        required: true,
        description: 'Use templates to pass data, e.g. {{steps.logs.output.lines}}',
        typeOptions: { rows: 6, expression: true },
      },
      {
        name: 'output',
        displayName: 'Answer format',
        type: 'options',
        default: 'text',
        options: [
          { name: 'Text', value: 'text' },
          { name: 'JSON (parsed)', value: 'json' },
        ],
      },
      { name: 'maxTokens', displayName: 'Max output tokens', type: 'number', default: 16000 },
      {
        name: 'effort',
        displayName: 'Effort (Claude)',
        type: 'options',
        default: '',
        description: 'How much the model thinks before answering. Other providers ignore it.',
        options: [
          { name: 'Model default', value: '' },
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' },
          { name: 'Extra high', value: 'xhigh' },
        ],
      },
    ],
    run: async t => {
      const cred = await t.credential('provider');
      const json = t.str('output') === 'json';
      const req: ModelRequest = {
        system: t.str('system') || undefined,
        prompt: t.str('prompt'),
        maxTokens: Math.max(1, Math.floor(t.num('maxTokens'))),
        json,
        model: t.str('model') || undefined,
        effort: (t.str('effort') || undefined) as ModelRequest['effort'],
      };
      if (t.context.dryRun) {
        return ok({
          dryRun: true,
          provider: cred.provider,
          model: req.model ?? metaString(cred, 'defaultModel'),
        });
      }
      t.context.emit?.({
        type: 'log',
        text: `${cred.provider}: asking ${req.model ?? 'default model'}`,
        timestamp: new Date(),
      });
      let reply: ModelReply;
      try {
        reply = await callModel(cred, req, t);
      } catch (err) {
        if (err instanceof StepInputError) throw err;
        const message =
          err instanceof Anthropic.APIError
            ? `HTTP ${err.status ?? '?'} — ${err.message}`
            : (err as Error).message;
        return fail(`ai.prompt: ${message}`);
      }
      return ok({
        text: reply.text,
        ...(json ? { json: parseJsonReply(reply.text) } : {}),
        model: reply.model,
        usage: { inputTokens: reply.inputTokens, outputTokens: reply.outputTokens },
      });
    },
  },
];
