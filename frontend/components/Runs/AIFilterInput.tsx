'use client';

import { Loader2, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface AIFilterResultSuccess {
  success: true;
  filters: {
    status?: string | null;
    runbook?: string | null;
    from?: string | null;
    to?: string | null;
  };
  explanation?: string;
}

interface AIFilterResultFailure {
  success: false;
  error: string;
  suggestions?: string[];
}

type AIFilterResult = AIFilterResultSuccess | AIFilterResultFailure;

interface AIFilterInputProps {
  /** Called with `{ status, runbook }` keys when the LLM resolves
   *  a query — the parent applies them to its own URL/state. */
  onApply: (filters: {
    status?: string | null;
    runbook?: string | null;
    from?: string | null;
    to?: string | null;
  }) => void;
  lang: 'en' | 'es';
}

const STRINGS = {
  en: {
    placeholder: 'Ask: "failed runs of deploy yesterday"',
    button: 'AI filter',
    loading: 'Asking…',
    examples: 'Try',
    error: 'Could not parse your filter',
  },
  es: {
    placeholder: 'Preguntá: "runs fallidos de deploy ayer"',
    button: 'Filtro AI',
    loading: 'Procesando…',
    examples: 'Probá',
    error: 'No pude entender tu filtro',
  },
} as const;

/**
 * Trigger.dev parity — ask-in-English search for the runs list.
 * Posts the operator's prompt to `/api/runs/ai-filter`, which calls
 * `generateObject` to translate it into a structured filter spec.
 *
 * The component is intentionally narrow: it owns its own input
 * state, fetches on submit, and hands the parsed filters to the
 * parent via `onApply`. The parent decides what to do with them
 * (typically: write to URL search params + re-fetch the list).
 */
export function AIFilterInput({ onApply, lang }: AIFilterInputProps) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [result, setResult] = useState<AIFilterResultFailure | null>(null);

  const submit = async () => {
    const prompt = text.trim();
    if (!prompt || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/runs/ai-filter`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt }),
      });
      const body = (await res.json()) as AIFilterResult;
      if (body.success) {
        onApply(body.filters);
        setText('');
      } else {
        setResult(body);
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        className="rb-ai-glow flex items-center gap-2 rounded-md border border-violet-500/40 bg-violet-500/5 px-2 py-1.5"
        // Glow only paints while the operator is engaging with the
        // input — focus, an in-flight request, or a non-empty draft.
        // Idle state is calm so a busy runs page is not strobed.
        data-glow={focused || loading || text.length > 0 ? 'on' : 'off'}
      >
        <Sparkles size={13} className="shrink-0 text-violet-300" />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
            if (e.key === 'Escape') {
              setText('');
              setResult(null);
            }
          }}
          placeholder={t.placeholder}
          disabled={loading}
          className="min-w-[18rem] flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
        />
        {text ? (
          <button
            type="button"
            onClick={() => setText('')}
            aria-label="clear"
            className="rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
          >
            <X size={11} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={loading || !text.trim()}
          className="flex items-center gap-1 rounded bg-violet-500/20 px-2 py-0.5 text-[11px] font-medium text-violet-200 transition-colors hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {loading ? t.loading : t.button}
        </button>
      </div>
      {result ? (
        <div className="rounded border border-rose-500/40 bg-rose-500/5 px-2 py-1 text-[11px] text-rose-300">
          <p>
            {t.error}: {result.error}
          </p>
          {result.suggestions && result.suggestions.length > 0 ? (
            <p className="mt-0.5 text-[10px] text-rose-200/70">
              {t.examples}:{' '}
              {result.suggestions.map((s, i) => (
                <span key={s}>
                  <button
                    type="button"
                    onClick={() => setText(s)}
                    className="underline decoration-dotted underline-offset-2 hover:text-rose-100"
                  >
                    {s}
                  </button>
                  {i < result.suggestions!.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
