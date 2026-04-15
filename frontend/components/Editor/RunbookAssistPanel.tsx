'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Loader2, AlertCircle, BookOpen, CheckCircle2 } from 'lucide-react';
import type { WorkflowNode } from '@cairn/shared';

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
        subtitle: 'Ask NanoRun to diagnose a failing step.',
        noFailure: 'Select a failed step to get a diagnosis, or paste an error below.',
        stepLabel: 'Step',
        errorLabel: 'Error',
        questionLabel: 'Optional question',
        questionPh: 'e.g. why did the deploy time out?',
        ask: 'Diagnose',
        thinking: 'Thinking...',
        applyFix: 'Apply suggested fix',
        openDocs: 'Open documentation',
        markKnown: 'Mark as known issue',
        actionsTodo: 'Actions are coming soon',
        failed: 'Diagnosis failed',
    },
    es: {
        title: 'Asistente IA',
        subtitle: 'Pide a NanoRun que diagnostique un paso fallido.',
        noFailure: 'Selecciona un paso fallido o pega un error abajo.',
        stepLabel: 'Paso',
        errorLabel: 'Error',
        questionLabel: 'Pregunta opcional',
        questionPh: 'ej. ¿por qué se cayó el deploy?',
        ask: 'Diagnosticar',
        thinking: 'Pensando...',
        applyFix: 'Aplicar arreglo sugerido',
        openDocs: 'Abrir documentación',
        markKnown: 'Marcar como conocido',
        actionsTodo: 'Las acciones llegan pronto',
        failed: 'Diagnóstico fallido',
    },
};

/**
 * Parses one line of the Vercel AI SDK data stream protocol.
 * Lines look like `0:"chunk"` (text) or `d:{"finishReason":"stop"}` (done).
 */
function parseStreamLine(line: string): { kind: 'text' | 'done' | 'other'; value: string } {
    const colon = line.indexOf(':');
    if (colon < 0) return { kind: 'other', value: '' };
    const tag = line.slice(0, colon);
    const rest = line.slice(colon + 1);
    if (tag === '0') {
        try {
            return { kind: 'text', value: JSON.parse(rest) };
        } catch {
            return { kind: 'other', value: '' };
        }
    }
    if (tag === 'd') return { kind: 'done', value: '' };
    return { kind: 'other', value: '' };
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
    const [reply, setReply] = useState('');
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!open) {
            setReply('');
            setError(null);
            setStreaming(false);
            abortRef.current?.abort();
        }
    }, [open]);

    if (!open) return null;

    const ask = async () => {
        setError(null);
        setReply('');
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
                        setReply((prev) => prev + parsed.value);
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
        <div className="fixed right-0 top-0 z-[90] h-full w-full max-w-md border-l border-zinc-800 bg-zinc-950 text-white shadow-2xl flex flex-col">
            <header className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
                <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 text-violet-400" size={18} />
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

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {!hasFailureContext && (
                    <div className="rounded border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-zinc-400">
                        {t.noFailure}
                    </div>
                )}

                {failedNode && (
                    <div>
                        <div className="text-[11px] font-bold uppercase text-zinc-500 mb-1">
                            {t.stepLabel}
                        </div>
                        <div className="rounded bg-zinc-900 px-3 py-2 text-sm">
                            <div className="font-medium">{failedNode.title}</div>
                            <div className="text-xs text-zinc-500 font-mono">{failedNode.type}</div>
                        </div>
                    </div>
                )}

                <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500 mb-1">
                        {t.errorLabel}
                    </div>
                    <textarea
                        value={errorOverride || errorMessage || ''}
                        onChange={(e) => setErrorOverride(e.target.value)}
                        rows={4}
                        placeholder="Paste a stderr block, exit code, or error message..."
                        className="w-full rounded border border-zinc-800 bg-black p-2 font-mono text-xs text-zinc-100 focus:border-zinc-600 focus:outline-none"
                    />
                </div>

                <div>
                    <div className="text-[11px] font-bold uppercase text-zinc-500 mb-1">
                        {t.questionLabel}
                    </div>
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder={t.questionPh}
                        className="w-full rounded border border-zinc-800 bg-black p-2 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
                    />
                </div>

                <button
                    onClick={ask}
                    disabled={streaming || !hasFailureContext}
                    className="flex w-full items-center justify-center gap-2 rounded bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
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

                {(reply || streaming) && (
                    <div className="rounded border border-zinc-800 bg-black/40 p-3">
                        <div className="text-[11px] font-bold uppercase text-violet-400 mb-2">
                            NanoRun AI
                        </div>
                        <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-100">
                            {reply}
                            {streaming && <span className="animate-pulse">▍</span>}
                        </pre>
                    </div>
                )}
            </div>

            {reply && !streaming && (
                <footer className="border-t border-zinc-800 px-5 py-3 space-y-2">
                    <p className="text-[10px] text-zinc-500 italic">{t.actionsTodo}</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            disabled
                            className="flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-500"
                        >
                            <Sparkles size={11} /> {t.applyFix}
                        </button>
                        <button
                            disabled
                            className="flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-500"
                        >
                            <BookOpen size={11} /> {t.openDocs}
                        </button>
                        <button
                            disabled
                            className="flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-[11px] text-zinc-500"
                        >
                            <CheckCircle2 size={11} /> {t.markKnown}
                        </button>
                    </div>
                </footer>
            )}
        </div>
    );
}
