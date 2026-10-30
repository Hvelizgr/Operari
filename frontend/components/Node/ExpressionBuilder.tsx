'use client';

import { Connection, WorkflowNode } from '@operari/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Database, FileJson, Search, Variable, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ExpressionBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (expression: string) => void;
  nodes: WorkflowNode[];
  connections: Connection[];
  lang: 'en' | 'es';
}

// Fields each executor actually returns, so `steps.<id>.output.<field>`
// resolves at run time. Types missing here (operari.set builds its own
// fields) still offer the whole `output` object.
const STEP_OUTPUT_FIELDS: Record<string, string[]> = {
  shell: ['stdout', 'stderr', 'exitCode'],
  ssh: ['stdout', 'stderr', 'exitCode'],
  'operari.httpRequest': ['status', 'statusText', 'body', 'headers', 'url'],
  'operari.database': ['rows', 'rowCount', 'connected', 'serverVersion', 'latencyMs'],
  'operari.if': ['conditionResult'],
  'operari.switch': ['matchedCase', 'matchedLabel', 'switchValue'],
  'operari.loop': ['items', 'count'],
  wait: ['waitedMs'],
  approval: ['approvalId', 'status'],
  notify: ['sent', 'channel'],
  runbook: ['childExecutionId', 'runbookId', 'status'],
  'github.commitFile': ['commitSha', 'htmlUrl', 'branch', 'path', 'created'],
  'github.issue': ['number', 'url', 'id'],
  'jira.issue': ['key', 'id', 'url'],
  'pagerduty.event': ['dedupKey', 'result'],
  'opsgenie.alert': ['requestId', 'result'],
  'telegram.message': ['messageId'],
  'email.send': ['messageId', 'accepted', 'rejected'],
  'datadog.event': ['eventId', 'url'],
  'grafana.annotation': ['annotationId'],
  'operari.redis': ['result'],
  'operari.crypto': ['value'],
  'operari.dateTime': ['iso', 'unix', 'ms', 'local'],
};

const ORGANIZATION_TYPES = new Set(['custom.frame', 'custom.note']);

const VARIABLES = [
  {
    expr: 'vars.<input>',
    insert: 'vars.',
    description: {
      en: 'A run input declared in Runbook settings → Inputs',
      es: 'Un input de ejecución declarado en Configuración del runbook → Inputs',
    },
  },
  {
    expr: 'currentItem',
    insert: 'currentItem',
    description: {
      en: 'Inside a loop body: the current item',
      es: 'Dentro de un loop: el elemento actual',
    },
  },
  {
    expr: 'currentIndex',
    insert: 'currentIndex',
    description: {
      en: 'Inside a loop body: position of the current item (0-based)',
      es: 'Dentro de un loop: posición del elemento actual (desde 0)',
    },
  },
];

const TEXT = {
  en: {
    title: 'Expression builder',
    steps: 'Step outputs',
    variables: 'Variables',
    search: 'Search…',
    noSteps: 'No other steps on the canvas yet',
    wholeOutput: 'whole output',
    custom: 'Custom expression',
    customHint: 'A path such as vars.service or steps.<id>.output.body',
    insert: 'Insert',
  },
  es: {
    title: 'Constructor de expresiones',
    steps: 'Salidas de pasos',
    variables: 'Variables',
    search: 'Buscar…',
    noSteps: 'Todavía no hay otros pasos en el canvas',
    wholeOutput: 'salida completa',
    custom: 'Expresión personalizada',
    customHint: 'Una ruta como vars.service o steps.<id>.output.body',
    insert: 'Insertar',
  },
};

export default function ExpressionBuilder({
  isOpen,
  onClose,
  onInsert,
  nodes,
  lang,
}: ExpressionBuilderProps) {
  const [activeTab, setActiveTab] = useState<'steps' | 'variables'>('steps');
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const t = TEXT[lang];

  const insert = (path: string) => {
    onInsert(`{{${path}}}`);
    onClose();
  };

  const steps = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return nodes.filter(
      n =>
        !ORGANIZATION_TYPES.has(n.type) &&
        (!term ||
          (n.title || '').toLowerCase().includes(term) ||
          n.id.toLowerCase().includes(term) ||
          n.type.toLowerCase().includes(term))
    );
  }, [nodes, searchTerm]);

  const tabClass = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'text-primary/70 border-primary/70 bg-primary/10 border-b-2'
        : 'text-gray-400 hover:text-white'
    }`;
  const rowClass =
    'flex w-full items-center justify-between rounded px-2 py-1.5 text-left font-mono text-xs text-gray-300 hover:bg-white/10 hover:text-white';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.title}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex h-[600px] max-h-[90vh] w-[700px] max-w-[95vw] flex-col overflow-hidden rounded-lg border border-gray-700 bg-[#1a1a2e] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-700 bg-[#16162a] p-4">
              <div className="flex items-center gap-2 font-bold text-white">
                <Database size={18} className="text-primary/70" />
                {t.title}
              </div>
              <button
                onClick={onClose}
                aria-label={lang === 'en' ? 'Close' : 'Cerrar'}
                className="text-gray-400 transition-colors hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-gray-700 bg-[#16162a]">
              <button
                onClick={() => setActiveTab('steps')}
                className={tabClass(activeTab === 'steps')}
              >
                <FileJson size={14} />
                {t.steps}
              </button>
              <button
                onClick={() => setActiveTab('variables')}
                className={tabClass(activeTab === 'variables')}
              >
                <Variable size={14} />
                {t.variables}
              </button>
            </div>

            {activeTab === 'steps' && (
              <div className="border-b border-gray-700 bg-black/20 p-3">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    type="text"
                    placeholder={t.search}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="focus:border-primary w-full rounded-md border border-gray-700 bg-[#0d0d1a] py-2 pl-9 pr-3 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2">
              {activeTab === 'steps' &&
                (steps.length === 0 ? (
                  <div className="mt-10 text-center text-sm text-gray-500">{t.noSteps}</div>
                ) : (
                  steps.map(node => {
                    const isOpenNode = expanded.includes(node.id);
                    const base = `steps.${node.id}.output`;
                    return (
                      <div
                        key={node.id}
                        className="mb-2 rounded border border-gray-700/50 bg-[#1f1f35]"
                      >
                        <button
                          onClick={() =>
                            setExpanded(prev =>
                              prev.includes(node.id)
                                ? prev.filter(id => id !== node.id)
                                : [...prev, node.id]
                            )
                          }
                          className="flex w-full items-center gap-2 p-2 text-left transition-colors hover:bg-white/5"
                        >
                          {isOpenNode ? (
                            <ChevronDown size={14} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={14} className="text-gray-400" />
                          )}
                          <span className="text-sm font-semibold text-gray-200">
                            {node.title || node.id}
                          </span>
                          <span className="ml-auto rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-gray-500">
                            {node.type.split('.').pop()}
                          </span>
                        </button>
                        {isOpenNode && (
                          <div className="border-t border-gray-700/30 bg-black/20 p-2 pl-6">
                            <button className={rowClass} onClick={() => insert(base)}>
                              <span>output</span>
                              <span className="text-[10px] text-gray-500">{t.wholeOutput}</span>
                            </button>
                            {(STEP_OUTPUT_FIELDS[node.type] ?? []).map(field => (
                              <button
                                key={field}
                                className={rowClass}
                                onClick={() => insert(`${base}.${field}`)}
                              >
                                <span>output.{field}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ))}

              {activeTab === 'variables' &&
                VARIABLES.map(v => (
                  <button
                    key={v.expr}
                    onClick={() =>
                      v.insert.endsWith('.') ? setCustom(v.insert) : insert(v.insert)
                    }
                    className="mb-1 w-full rounded border border-gray-700/50 bg-[#1f1f35] p-3 text-left hover:bg-white/5"
                  >
                    <div className="text-primary/70 font-mono text-sm">{`{{${v.expr}}}`}</div>
                    <div className="mt-1 text-xs text-gray-400">{v.description[lang]}</div>
                  </button>
                ))}
            </div>

            <div className="border-t border-gray-700 bg-[#16162a] p-3">
              <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">
                {t.custom}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && custom.trim()) insert(custom.trim());
                  }}
                  placeholder={t.customHint}
                  className="focus:border-primary flex-1 rounded-md border border-gray-700 bg-[#0d0d1a] px-3 py-2 font-mono text-sm text-white focus:outline-none"
                />
                <button
                  onClick={() => custom.trim() && insert(custom.trim())}
                  disabled={!custom.trim()}
                  className="bg-primary rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {t.insert}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
