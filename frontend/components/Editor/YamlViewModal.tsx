'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Copy, Check, Save, AlertCircle } from 'lucide-react';
import type { WorkflowNode, Connection } from '@cairn/shared';
import {
    nodesToSpec,
    specToYaml,
    yamlToSpec,
    specToNodes,
    RunbookYamlError,
    RunbookHeader,
} from '@/utils/runbookYaml';

interface YamlViewModalProps {
    open: boolean;
    onClose: () => void;
    lang: 'en' | 'es';
    header: RunbookHeader;
    nodes: WorkflowNode[];
    connections: Connection[];
    onApply: (next: { header: RunbookHeader; nodes: WorkflowNode[]; connections: Connection[] }) => void;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
    en: {
        title: 'Runbook YAML',
        subtitle: 'Edit the runbook as code. Save to replace the visual canvas with this YAML.',
        copy: 'Copy',
        copied: 'Copied',
        save: 'Save changes',
        cancel: 'Cancel',
        invalid: 'Invalid YAML',
    },
    es: {
        title: 'YAML del runbook',
        subtitle: 'Edita el runbook como código. Al guardar reemplazas el lienzo visual con este YAML.',
        copy: 'Copiar',
        copied: 'Copiado',
        save: 'Guardar cambios',
        cancel: 'Cancelar',
        invalid: 'YAML inválido',
    },
};

export default function YamlViewModal({
    open,
    onClose,
    lang,
    header,
    nodes,
    connections,
    onApply,
}: YamlViewModalProps) {
    const t = STRINGS[lang] ?? STRINGS.en;

    const initial = useMemo(() => {
        if (!open) return '';
        try {
            return specToYaml(nodesToSpec(header, nodes, connections));
        } catch (err) {
            return `# Failed to serialize: ${err instanceof Error ? err.message : String(err)}\n`;
        }
    }, [open, header, nodes, connections]);

    const [text, setText] = useState(initial);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setText(initial);
        setError(null);
    }, [initial]);

    if (!open) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // ignore
        }
    };

    const handleSave = async () => {
        try {
            const spec = yamlToSpec(text);
            // JSON Schema validation against the canonical schema served
            // by the backend. Best-effort: if the schema is unreachable
            // we let the save through with a warning. If it IS reachable
            // and the spec violates it, we block save and show errors.
            const { validateRunbookSpec } = await import('@/utils/runbookSchemaValidator');
            const result = await validateRunbookSpec(spec);
            if (!result.valid) {
                setError(`${t.invalid}:\n${result.errors.join('\n')}`);
                return;
            }
            const parsed = specToNodes(spec);
            onApply(parsed);
            onClose();
        } catch (err) {
            if (err instanceof RunbookYamlError) {
                setError(`${t.invalid}: ${err.message}`);
            } else {
                setError(err instanceof Error ? err.message : String(err));
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6">
            <div className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
                <header className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
                    <div>
                        <h2 className="text-base font-semibold text-white">{t.title}</h2>
                        <p className="mt-0.5 text-xs text-zinc-400">{t.subtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="flex-1 overflow-hidden p-3">
                    <textarea
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            if (error) setError(null);
                        }}
                        spellCheck={false}
                        className="h-full w-full resize-none rounded border border-zinc-800 bg-black p-3 font-mono text-xs leading-relaxed text-zinc-100 focus:border-zinc-600 focus:outline-none"
                    />
                </div>

                {error && (
                    <div className="mx-3 mb-2 flex items-start gap-2 rounded border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-snug">
                            {error}
                        </pre>
                    </div>
                )}

                <footer className="flex items-center justify-between gap-2 border-t border-zinc-800 px-5 py-3">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? t.copied : t.copy}
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                        >
                            {t.cancel}
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                        >
                            <Save size={14} />
                            {t.save}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
