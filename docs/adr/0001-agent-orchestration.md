# ADR 0001 — Agent orchestration: Vercel AI SDK over Mastra

- **Status:** accepted
- **Date:** 2026-04-07
- **Context links:** `IMPLEMENTACION_NANORUN.md` P0 #6, `INVESTIGACION_NANORUN_2026.md`

## Context

`backend/src/agent/` ships with [Mastra](https://mastra.ai) (`@mastra/core`,
`@mastra/mcp`) wrapping a single conversational agent that streams replies
to the editor sidebar. Mastra is a TypeScript framework for building agent
systems with multi-agent workflows, RAG, tools, evals, telemetry, and a
managed dev playground.

Today, the actual usage is one file:
`backend/src/agent/services/chat-stream.service.ts:51` calls
`mastra.getAgent('orchestrator').stream(messages)` and forwards the text
chunks over an SSE stream that already speaks the Vercel AI SDK Data Stream
v1 protocol (`X-Vercel-AI-Data-Stream: v1`).

The agent itself
(`backend/src/agent/mastra/agents/orchestrator.agent.ts`) is a 63-line file
that wires `instructions` + a model from `@ai-sdk/anthropic` /
`@ai-sdk/openai`. **No tools, no RAG, no memory, no evals, no multi-agent
workflows are configured.** `@mastra/mcp` is imported by `package.json` but
no source file imports it.

The roadmap doc is explicit: *“Mastra agrega complejidad para un agent que
es básicamente tool calling + RAG sobre logs. Si no usás features
multi-agent → reemplazar con Vercel AI SDK + LiteLLM gateway.”*

## Decision

**Drop `@mastra/core` and `@mastra/mcp`. Use the Vercel AI SDK (`ai`)
directly via `streamText`.** The `ai` package is already a dependency
(`backend/package.json` line 31, `^6.0.149`) because Mastra uses it
internally.

The orchestrator becomes a thin function in `backend/src/agent/orchestrator.ts`:

```ts
import { streamText, type ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export function streamOrchestratorReply(messages: ModelMessage[]) {
    const provider = process.env.AI_MODEL_PROVIDER ?? 'anthropic';
    const modelName = process.env.AI_MODEL_NAME ?? 'claude-sonnet-4-6';
    const model = provider === 'openai' ? openai(modelName) : anthropic(modelName);
    return streamText({ model, system: SYSTEM_PROMPT, messages });
}
```

`chat-stream.service.ts` calls `streamOrchestratorReply(...)` and iterates
`result.textStream` exactly as it does today.

## Consequences

**Positive**

- Removes two dependencies (`@mastra/core`, `@mastra/mcp`) and the surface
  area they pull in (Mastra storage layer, telemetry adapters, agent
  registry, dev playground).
- Removes one indirection: `mastra.getAgent('id').stream()` →
  `streamText({ ... })`.
- Aligns the codebase with the SSE Data Stream v1 protocol the frontend
  already expects.
- Smaller install, faster `tsc`, fewer transitive vulnerabilities to track.
- Keeps the door open for LiteLLM as the OpenAI-compatible gateway: a
  LiteLLM endpoint slots in via `createOpenAI({ baseURL })` from
  `@ai-sdk/openai` without touching the orchestrator.

**Negative / risks**

- If we ever want multi-agent workflows, evals, or Mastra’s memory adapter,
  we either re-add Mastra or build the equivalent on top of `ai`. We’re
  betting we will not need those before re-evaluating.
- Tool-calling will be wired manually via `streamText({ tools })` instead of
  Mastra’s tool registry. The `ai` SDK already supports this and the API is
  stable.
- We lose Mastra’s built-in OTel hooks. We already have OTel scaffolding
  via `@opentelemetry/*` and instrument the chat path ourselves.

## Alternatives considered

1. **Keep Mastra.** Rejected — pays a complexity tax for unused features
   and contradicts the explicit roadmap directive.
2. **LangChain.js.** Rejected — heavier than Mastra, same problem.
3. **Roll our own provider abstraction.** Rejected — `ai` already does
   this, with first-party adapters for every model we care about.
4. **Anthropic SDK directly.** Rejected — we want to keep the OpenAI escape
   hatch and the LiteLLM compatibility, both of which are free with the
   Vercel AI SDK.

## Revisit when

- We need multi-agent orchestration (specialist agents handing off work).
- We add long-lived agent memory beyond the existing `Conversation` table.
- A tool registry with >10 tools becomes painful to maintain ad hoc.
- We need built-in evals to gate model upgrades.

If two of those become true, re-evaluate Mastra (or a successor) in a new
ADR.

## Migration notes

- Delete `backend/src/agent/mastra/`
- Create `backend/src/agent/orchestrator.ts` (function above)
- Update `backend/src/agent/services/chat-stream.service.ts` to import
  `streamOrchestratorReply`
- Remove `@mastra/core` and `@mastra/mcp` from `backend/package.json`
- Run `npm install` and `npm test -w backend`
