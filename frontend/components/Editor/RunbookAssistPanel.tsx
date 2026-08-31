'use client';

import type { WorkflowNode } from '@operari/shared';
import { AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronRight, Loader2, Sparkles, Wrench, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface RunbookAssistPanelProps {
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
  /** Pre-selected failed node, if any. The panel can also operate manually. */
  failedNode?: WorkflowNode | null;
  /** Optional run id from a real execution; gives the backend full log access. */
  runId?: string | null;
  /** Optional step id within the run. */
  stepId?: string | null;
  /** Last seen error message for the failed node. */
  errorMessage?: string | null;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
  en: {
    title: 'AI assist',
    subtitle: 'Ask Operari to diagnose a failing step.',
    noFailure: 'Select a failed step to get a diagnosis, or paste an error below.',
    stepLabel: 'Step',
    errorLabel: 'Error',
    questionLabel: 'Question (the agent can pull related runs and logs)',
    questionPh: 'e.g. why did the deploy time out?',
    ask: 'Diagnose',
    thinking: 'Thinking...',
    suggested: 'Try asking',
    suggestHistory: 'Has this error happened before?',
    suggestRecent: 'Show recent failed runs',
    suggestCompare: 'What changed since the last success?',
    failed: 'Diagnosis failed',
    brand: 'Operari AI',
  },
  es: {
    title: 'Asistente IA',
    subtitle: 'Pedile a Operari que diagnostique un paso fallido.',
    noFailure: 'Selecciona un paso fallido o pega un error abajo.',
    stepLabel: 'Paso',
    errorLabel: 'Error',
    questionLabel: 'Pregunta (el agente puede traer runs y logs relacionados)',
    questionPh: 'ej. ¿por qué se cayó el deploy?',
    ask: 'Diagnosticar',
    thinking: 'Pensando...',
    suggested: 'Probá preguntando',
    suggestHistory: '¿Este error ya pasó antes?',
    suggestRecent: 'Mostrame runs fallidos recientes',
    suggestCompare: '¿Qué cambió desde el último éxito?',
    failed: 'Diagnóstico fallido',
    brand: 'Operari AI',
  },
};

/**
 * Each piece of the assistant's reply, in arrival order. The
 * orchestrator interleaves text with tool calls (e.g. "Let me check…"
 * → list_recent_runs → "I see that…" → get_step_logs → final answer);
 * the panel renders each event as its own block so the user can
 * follow the agent's reasoning instead of staring at "Thinking…"
 * for ten seconds.
 */
type AssistEvent =
  | { kind: 'text'; text: string }
  | {
      kind: 'tool';
      id: string;
      name: string;
      args: unknown;
      result?: unknown;
    };

interface ParsedLine {
  kind: 'text' | 'tool-call' | 'tool-result' | 'done' | 'other';
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
}

/**
 * Parse one line of the v1 Vercel AI SDK data stream protocol the
 * backend speaks. Tag mapping:
 *   0:"text"                                          — text chunk
 *   9:{toolCallId, toolName, args}                    — tool call
 *   a:{toolCallId, result}                            — tool result
 *   d:{finishReason}                                  — done
 * Anything else is dropped silently — the SDK emits protocol-level
 * events (text-start, finish-step, reasoning) the panel does not need.
 */
function parseStreamLine(line: string): ParsedLine {
  const colon = line.indexOf(':');
  if (colon < 0) return { kind: 'other' };
  const tag = line.slice(0, colon);
  const rest = line.slice(colon + 1);

  try {
    if (tag === '0') return { kind: 'text', text: JSON.parse(rest) };
    if (tag === '9') {
      const payload = JSON.parse(rest) as { toolCallId: string; toolName: string; args: unknown };
      return {
        kind: 'tool-call',
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        args: payload.args,
      };
    }
    if (tag === 'a') {
      const payload = JSON.parse(rest) as { toolCallId: string; result: unknown };
      return { kind: 'tool-result', toolCallId: payload.toolCallId, result: payload.result };
    }
    if (tag === 'd') return { kind: 'done' };
  } catch {
    return { kind: 'other' };
  }
  return { kind: 'other' };
}

export default function RunbookAssistPanel({
  open,
  onClose,
  lang,
  failedNode,
  runId,
  stepId,
  errorMessage,
}: RunbookAssistPanelProps) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [question, setQuestion] = useState('');
  const [errorOverride, setErrorOverride] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [events, setEvents] = useState<AssistEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      setEvents([]);
      setError(null);
      setStreaming(false);
      abortRef.current?.abort();
    }
  }, [open]);

  const ask = async () => {
    setError(null);
    setEvents([]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const body = {
      runId: runId ?? undefined,
      stepId: stepId ?? failedNode?.id,
      stepName: failedNode?.title,
      stepType: failedNode?.type,
      stepConfig: failedNode?.config as Record<string, unknown> | undefined,
      errorMessage: errorOverride.trim() || errorMessage || undefined,
      question: question.trim() || undefined,
    };

    try {
      const res = await fetch(`${apiBase}/api/runbook-assist/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          const parsed = parseStreamLine(line);
          if (parsed.kind === 'text') {
            const text = parsed.text ?? '';
            setEvents(prev => {
              // Coalesce contiguous text deltas into one block so the
              // DOM doesn't get a new <pre> per token.
              const last = prev[prev.length - 1];
              if (last && last.kind === 'text') {
                return [...prev.slice(0, -1), { ...last, text: last.text + text }];
              }
              return [...prev, { kind: 'text', text }];
            });
          } else if (parsed.kind === 'tool-call') {
            const id = parsed.toolCallId ?? '';
            const name = parsed.toolName ?? '';
            const args = parsed.args;
            setEvents(prev => [...prev, { kind: 'tool', id, name, args }]);
          } else if (parsed.kind === 'tool-result') {
            const id = parsed.toolCallId ?? '';
            const result = parsed.result;
            setEvents(prev =>
              prev.map(ev => (ev.kind === 'tool' && ev.id === id ? { ...ev, result } : ev))
            );
          } else if (parsed.kind === 'done') {
            // stream complete
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
    }
  };

  const hasFailureContext = !!(errorMessage || errorOverride.trim() || failedNode);

  return (
    <AnimatePresence>
    {open && (
    <div className="fixed right-0 top-0 z-[90] flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 text-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
        <div className="flex items-start gap-2">
          <Sparkles className="text-primary/70 mt-0.5" size={18} />
          <div>
            <h2 className="text-base font-semibold">{t.title}</h2>
            <p className="mt-0.5 text-xs text-zinc-400">{t.subtitle}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {!hasFailureContext && (
          <div className="rounded border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-zinc-400">
            {t.noFailure}
          </div>
        )}

        {failedNode && (
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase text-zinc-500">{t.stepLabel}</div>
            <div className="rounded bg-zinc-900 px-3 py-2 text-sm">
              <div className="font-medium">{failedNode.title}</div>
              <div className="font-mono text-xs text-zinc-500">{failedNode.type}</div>
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 text-[11px] font-bold uppercase text-zinc-500">{t.errorLabel}</div>
          <textarea
            value={errorOverride || errorMessage || ''}
            onChange={e => setErrorOverride(e.target.value)}
            rows={4}
            placeholder="Paste a stderr block, exit code, or error message..."
            className="w-full rounded border border-zinc-800 bg-black p-2 font-mono text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
          />
        </div>

        <div>
          <div className="mb-1 text-[11px] font-bold uppercase text-zinc-500">
            {t.questionLabel}
          </div>
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder={t.questionPh}
            className="w-full rounded border border-zinc-800 bg-black p-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="self-center text-[10px] uppercase text-zinc-600">{t.suggested}:</span>
            {[t.suggestHistory, t.suggestRecent, t.suggestCompare].map(q => (
              <button
                key={q}
                type="button"
                onClick={() => setQuestion(q)}
                disabled={streaming}
                className="hover:border-primary hover:text-primary/40 rounded border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[11px] text-zinc-400 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={ask}
          disabled={streaming || !hasFailureContext}
          className="bg-primary hover:bg-primary flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {streaming ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t.thinking}
            </>
          ) : (
            <>
              <Sparkles size={14} />
              {t.ask}
            </>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">{t.failed}</div>
              <div className="opacity-80">{error}</div>
            </div>
          </div>
        )}

        {(events.length > 0 || streaming) && (
          <div className="rounded border border-zinc-800 bg-black/40 p-3">
            <div className="text-primary/70 mb-2 text-[11px] font-bold uppercase">{t.brand}</div>
            <div className="space-y-2">
              {events.map((ev, idx) =>
                ev.kind === 'text' ? (
                  <pre key={idx} className="whitespace-pre-wrap font-sans text-sm text-zinc-100">
                    {ev.text}
                    {streaming && idx === events.length - 1 && (
                      <span className="animate-pulse">▍</span>
                    )}
                  </pre>
                ) : (
                  <ToolCallBlock key={idx} event={ev} />
                )
              )}
              {streaming && events.length === 0 && (
                <span className="animate-pulse text-zinc-500">▍</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    )}
    </AnimatePresence>
  );
}

/**
 * Visible bubble for one orchestrator tool call. Header always shows
 * `tool_name(arg=value, …)` so the user reads what the agent did at
 * a glance; the full args + result blob expands on click. Pending
 * calls (no result yet, mid-stream) get a subtle spinner.
 *
 * Why this is its own component: the iteration in the parent uses an
 * `idx` key which is stable enough for the streaming case but the
 * collapsible state needs to live somewhere — so each block owns its
 * own open/closed flag.
 */
function ToolCallBlock({
  event,
}: {
  event: { kind: 'tool'; id: string; name: string; args: unknown; result?: unknown };
}) {
  const [open, setOpen] = useState(false);
  const pending = event.result === undefined;
  const argSummary = summarizeArgs(event.args);

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-zinc-800/40"
      >
        <ChevronRight
          size={11}
          className={`shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <Wrench size={11} className="shrink-0 text-amber-400/80" />
        <span className="truncate font-mono text-[11px] text-zinc-200">
          {event.name}
          <span className="text-zinc-500">({argSummary})</span>
        </span>
        {pending ? (
          <Loader2 size={11} className="ml-auto shrink-0 animate-spin text-zinc-500" />
        ) : (
          <span className="ml-auto shrink-0 text-[10px] text-emerald-400/70">ok</span>
        )}
      </button>
      {open && (
        <div className="space-y-1 border-t border-zinc-800/60 px-2 py-1.5 text-[10px]">
          <div>
            <div className="mb-0.5 text-zinc-500">args</div>
            <pre className="whitespace-pre-wrap break-words font-mono text-zinc-300">
              {JSON.stringify(event.args, null, 2)}
            </pre>
          </div>
          <div>
            <div className="mb-0.5 text-zinc-500">result</div>
            <pre className="whitespace-pre-wrap break-words font-mono text-zinc-300">
              {pending ? '…' : JSON.stringify(event.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  const entries = Object.entries(args as Record<string, unknown>);
  if (entries.length === 0) return '';
  // Truncate values aggressively — the full blob lives one click away.
  const parts = entries.map(([k, v]) => {
    const s = typeof v === 'string' ? `"${v.length > 24 ? v.slice(0, 24) + '…' : v}"` : String(v);
    return `${k}: ${s}`;
  });
  return parts.join(', ');
}
