'use client';

import type { Connection, WorkflowNode } from '@operari/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { FileCode, FileText, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import TemplatePreview from '@/app/[lang]/(marketing)/templates/TemplatePreview';
import { specToNodes, yamlToSpec } from '@/utils/runbookYaml';

/** Thin bridge: template gallery holds YAML strings, the shared
 *  TemplatePreview renders from parsed node/connection arrays. This
 *  wrapper does the one-shot parse per template card with useMemo
 *  so the 20+ cards don't re-parse on every gallery re-render. A
 *  parse failure falls back to nothing — the card's metadata still
 *  tells the operator what the template does. */
function TemplatePreviewFromYaml({ yaml }: { yaml: string }) {
  const parsed = useMemo(() => {
    try {
      const spec = yamlToSpec(yaml);
      return specToNodes(spec);
    } catch {
      return null;
    }
  }, [yaml]);
  if (!parsed || parsed.nodes.length === 0) return null;
  return (
    <div className="rounded border border-slate-700/40 bg-slate-900/40 p-1">
      <TemplatePreview
        nodes={parsed.nodes as WorkflowNode[]}
        connections={parsed.connections as Connection[]}
        height={110}
      />
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * TemplateGallery — modal that lets the operator pick one of the
 * curated YAML runbook templates from the repo's `templates/` directory
 * and drop it into the canvas.
 *
 * Templates are loaded live from `/api/templates` (real YAML files
 * committed to git). yaml→canvas conversion goes through the same
 * `specToNodes()` the YAML import modal uses, so the dropped runbook
 * is byte-identical to one imported via the YAML view.
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
    subtitle:
      'Soltá un runbook curado en el canvas para arrancar desde un ejemplo que ya funciona.',
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
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(j => setTemplates(j.data ?? []))
      .catch(e => setError(e instanceof Error ? e.message : 'unknown'));
  }, [isOpen, templates]);

  const handleSelect = (tpl: RemoteTemplate) => {
    try {
      const spec = yamlToSpec(tpl.yaml);
      const parsed = specToNodes(spec);
      onSelectTemplate(parsed.nodes, parsed.connections);
      setParseError(null);
      setIsOpen(false);
    } catch (err) {
      setParseError(`${t.parseError} (${err instanceof Error ? err.message : 'unknown'})`);
    }
  };

  const showInternalButton = controlledIsOpen === undefined;

  return (
    <>
      {showInternalButton && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute left-4 top-20 z-40 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 shadow-lg transition-colors hover:bg-slate-700"
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
              className="relative mx-4 flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">{t.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 transition-colors hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              {parseError && (
                <div className="mb-3 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  {parseError}
                </div>
              )}

              <div className="-mx-2 flex-1 overflow-y-auto px-2">
                {error ? (
                  <div className="text-sm text-red-400">
                    {t.loadError}: {error}
                  </div>
                ) : templates === null ? (
                  <div className="text-sm text-slate-500">{t.loading}</div>
                ) : templates.length === 0 ? (
                  <div className="text-sm text-slate-500">{t.empty}</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {templates.map(tpl => (
                      <button
                        key={tpl.file}
                        onClick={() => handleSelect(tpl)}
                        className="hover:border-primary hover:bg-primary/5 group flex flex-col gap-2 rounded-md border border-slate-700 p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-400/60"
                      >
                        <div className="flex items-center gap-2">
                          <FileCode size={14} className="text-primary/70 shrink-0" />
                          <span className="truncate text-sm font-medium text-slate-100">
                            {tpl.name}
                          </span>
                        </div>
                        {/* Mini-canvas preview of the runbook shape. The
                            operator recognises "this one branches" at a
                            glance instead of reading step counts. */}
                        <TemplatePreviewFromYaml yaml={tpl.yaml} />
                        {tpl.category && (
                          <span className="inline-block self-start rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                            {tpl.category}
                          </span>
                        )}
                        {tpl.description && (
                          <p className="line-clamp-2 text-xs text-slate-400">{tpl.description}</p>
                        )}
                        <div className="text-[10px] text-slate-500">
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
