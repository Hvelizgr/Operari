'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, FileCode, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { WorkflowNode, Connection } from '@cairn/shared';
import { yamlToSpec, specToNodes } from '@/utils/runbookYaml';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * TemplateGallery — modal that lets the operator pick one of the
 * curated YAML runbook templates from the repo's `templates/` directory
 * and drop it into the canvas.
 *
 * History note: this component used to ship with 6 hardcoded NanoFlow
 * templates (Email Notification, Data Sync, etc) using node types that
 * had no backend executor in NanoRun. The cleanup pass replaced that
 * with a live fetch from `/api/templates`, which serves the real YAML
 * templates the project commits to git. The yaml→canvas conversion
 * goes through the same `specToNodes()` the YAML modal uses, so the
 * dropped runbook is byte-identical to one imported via the YAML view.
 */

interface RemoteTemplate {
    file: string;
    slug: string;
    name: string;
    description: string | null;
    category: string | null;
    stepCount: number;
    yaml: string;
}

interface TemplateGalleryProps {
    onSelectTemplate: (nodes: WorkflowNode[], connections: Connection[]) => void;
    lang: 'en' | 'es';
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const STRINGS = {
    en: {
        title: 'Runbook templates',
        subtitle: 'Drop a curated runbook into the canvas to start from a working example.',
        openGallery: 'Templates',
        loading: 'Loading templates…',
        empty: 'No templates found in templates/.',
        loadError: 'Failed to load templates',
        parseError: 'Could not parse this template — check the YAML.',
        steps: 'steps',
        useTemplate: 'Use this template',
    },
    es: {
        title: 'Plantillas de runbook',
        subtitle: 'Soltá un runbook curado en el canvas para arrancar desde un ejemplo que ya funciona.',
        openGallery: 'Plantillas',
        loading: 'Cargando plantillas…',
        empty: 'No se encontraron plantillas en templates/.',
        loadError: 'Error cargando plantillas',
        parseError: 'No se pudo parsear esta plantilla — revisá el YAML.',
        steps: 'pasos',
        useTemplate: 'Usar esta plantilla',
    },
} as const;

export default function TemplateGallery({
    onSelectTemplate,
    lang,
    isOpen: controlledIsOpen,
    onOpenChange,
}: TemplateGalleryProps) {
    const t = STRINGS[lang] ?? STRINGS.en;
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const setIsOpen = (open: boolean) => {
        if (onOpenChange) onOpenChange(open);
        else setInternalIsOpen(open);
    };

    const [templates, setTemplates] = useState<RemoteTemplate[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        // Lazy-load: only hit the endpoint when the modal opens. Avoids
        // a network request on every editor render.
        if (templates !== null) return;
        fetch(`${API_BASE}/api/templates`)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((j) => setTemplates(j.data ?? []))
            .catch((e) => setError(e instanceof Error ? e.message : 'unknown'));
    }, [isOpen, templates]);

    const handleSelect = (tpl: RemoteTemplate) => {
        try {
            const spec = yamlToSpec(tpl.yaml);
            const parsed = specToNodes(spec);
            onSelectTemplate(parsed.nodes, parsed.connections);
            setParseError(null);
            setIsOpen(false);
        } catch (err) {
            setParseError(
                `${t.parseError} (${err instanceof Error ? err.message : 'unknown'})`,
            );
        }
    };

    const showInternalButton = controlledIsOpen === undefined;

    return (
        <>
            {showInternalButton && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="absolute top-20 left-4 flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-lg border border-slate-700 z-40"
                >
                    <FileText size={16} />
                    {t.openGallery}
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />

                        <motion.div
                            className="relative bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-100">
                                        {t.title}
                                    </h2>
                                    <p className="text-sm text-slate-400 mt-1">{t.subtitle}</p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {parseError && (
                                <div className="mb-3 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                                    {parseError}
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto -mx-2 px-2">
                                {error ? (
                                    <div className="text-sm text-red-400">
                                        {t.loadError}: {error}
                                    </div>
                                ) : templates === null ? (
                                    <div className="text-sm text-slate-500">{t.loading}</div>
                                ) : templates.length === 0 ? (
                                    <div className="text-sm text-slate-500">{t.empty}</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {templates.map((tpl) => (
                                            <button
                                                key={tpl.file}
                                                onClick={() => handleSelect(tpl)}
                                                className="text-left rounded-md border border-slate-700 hover:border-primary hover:bg-primary/5 p-3 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <FileCode
                                                        size={14}
                                                        className="text-primary/70"
                                                    />
                                                    <span className="text-sm font-medium text-slate-100 truncate">
                                                        {tpl.name}
                                                    </span>
                                                </div>
                                                {tpl.category && (
                                                    <span className="inline-block mb-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                                        {tpl.category}
                                                    </span>
                                                )}
                                                {tpl.description && (
                                                    <p className="text-xs text-slate-400 line-clamp-2">
                                                        {tpl.description}
                                                    </p>
                                                )}
                                                <div className="text-[10px] text-slate-500 mt-2">
                                                    {tpl.stepCount} {t.steps}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
