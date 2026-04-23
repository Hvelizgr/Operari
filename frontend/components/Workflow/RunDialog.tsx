// frontend/components/Workflow/RunDialog.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Bug } from 'lucide-react';
import type { RunbookInputDefinition } from '../Editor/RunbookInputsPanel';

interface LogEntry {
  timestamp: string;
  message: string;
  metadata?: any;
}

interface RunDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRun: (input: object) => void;
  lang: 'en' | 'es';
  isExecuting?: boolean;
  logs?: LogEntry[];
  executionId?: string | null;
  mode?: 'run' | 'debug';
  /** Typed input declarations. When non-empty the dialog renders a
   * form and collects values matching the declared types; when
   * empty it falls back to the raw JSON textarea. */
  inputs?: RunbookInputDefinition[];
}

function defaultsFor(inputs: RunbookInputDefinition[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const input of inputs) {
    if (input.default !== undefined) {
      out[input.name] = input.default;
    } else if (input.type === 'boolean') {
      out[input.name] = false;
    } else {
      out[input.name] = '';
    }
  }
  return out;
}

export default function RunDialog({
  isOpen,
  onClose,
  onRun,
  lang,
  isExecuting = false,
  logs = [],
  executionId,
  mode = 'run',
  inputs = [],
}: RunDialogProps) {
  const hasInputs = inputs.length > 0;
  const [jsonInput, setJsonInput] = useState(`{\n  "key": "value"\n}`);
  const [formValues, setFormValues] = useState<Record<string, unknown>>(() => defaultsFor(inputs));
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Re-seed form defaults when the declaration list changes identity
  // (e.g., navigating between runbooks or editing the inputs panel).
  const inputsFingerprint = useMemo(
    () => inputs.map(i => `${i.name}:${i.type}:${i.default ?? ''}`).join('|'),
    [inputs]
  );
  useEffect(() => {
    setFormValues(defaultsFor(inputs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputsFingerprint]);

  // ... timer logic ... (Same as before)
  // Timer for elapsed time
  useState(() => {
    const interval = setInterval(() => {
      if (isExecuting) {
        setElapsed(prev => prev + 0.1);
      } else {
        setElapsed(0);
      }
    }, 100);
    return () => clearInterval(interval);
  });

  const handleRunClick = () => {
    if (hasInputs) {
      for (const input of inputs) {
        const v = formValues[input.name];
        if (input.required && (v === '' || v === undefined || v === null)) {
          setError((lang === 'en' ? 'Required: ' : 'Obligatorio: ') + (input.label || input.name));
          return;
        }
        if (input.type === 'number' && v !== '' && v !== undefined && Number.isNaN(Number(v))) {
          setError(
            (lang === 'en' ? 'Not a number: ' : 'No es número: ') + (input.label || input.name)
          );
          return;
        }
      }
      const payload: Record<string, unknown> = {};
      for (const input of inputs) {
        const raw = formValues[input.name];
        if (raw === '' || raw === undefined) {
          if (input.default !== undefined) payload[input.name] = input.default;
          continue;
        }
        payload[input.name] =
          input.type === 'number' ? Number(raw) : input.type === 'boolean' ? !!raw : raw;
      }
      setError(null);
      onRun(payload);
      return;
    }
    try {
      const parsedInput = JSON.parse(jsonInput);
      setError(null);
      onRun(parsedInput);
    } catch {
      setError(lang === 'en' ? 'Invalid JSON format.' : 'Formato JSON inválido.');
    }
  };

  const text = {
    en: {
      title: isExecuting
        ? mode === 'debug'
          ? 'Debugging runbook...'
          : 'Running runbook...'
        : mode === 'debug'
          ? 'Debug runbook'
          : 'Run runbook',
      description: 'Provide JSON input:',
      run: mode === 'debug' ? 'Start debugging' : 'Run runbook',
      cancel: isExecuting ? 'Close' : 'Cancel',
      jobId: 'Run ID',
      status: 'Status',
      elapsed: 'Elapsed',
      cpu: 'Avg CPU',
      mem: 'Avg Mem',
    },
    es: {
      title: isExecuting
        ? mode === 'debug'
          ? 'Depurando runbook...'
          : 'Ejecutando runbook...'
        : mode === 'debug'
          ? 'Depurar runbook'
          : 'Ejecutar runbook',
      description: 'Entrada JSON:',
      run: mode === 'debug' ? 'Iniciar depuración' : 'Ejecutar runbook',
      cancel: isExecuting ? 'Cerrar' : 'Cancelar',
      jobId: 'ID Trabajo',
      status: 'Estado',
      elapsed: 'Tiempo',
      cpu: 'CPU Prom',
      mem: 'Mem Prom',
    },
  }[lang];

  // Simulated Stats or Real if provided (future)
  const cpuUsage = isExecuting ? Math.floor(Math.random() * 30 + 10) + '%' : '0%';
  const memUsage = isExecuting ? Math.floor(Math.random() * 200 + 50) + 'MB' : '0MB';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="dialog border-[var(--highlight-color)]/30 border shadow-[0px_0px_50px_rgba(0,0,0,0.8)]"
            style={
              {
                width: '600px',
                background: 'var(--box-background-color)',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              } as any
            }
            onClick={e => e.stopPropagation()}
          >
            {/* Title Bar */}
            <div
              className="dialog_title"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
                borderBottom: '1px solid var(--border-color)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '15px',
                fontWeight: 'bold',
                color: 'var(--highlight-color)',
                letterSpacing: '0.05em',
              }}
            >
              <div className="flex items-center gap-2">
                {mode === 'debug' ? (
                  <Bug
                    size={16}
                    className={isExecuting ? 'text-primary/70 animate-pulse' : 'text-primary/70'}
                  />
                ) : (
                  <Play size={16} className={isExecuting ? 'animate-pulse text-green-400' : ''} />
                )}
                {text.title}
              </div>
              {!isExecuting && (
                <button
                  className="opacity-50 transition-opacity hover:opacity-100"
                  onClick={onClose}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Content Switcher */}
            <div className="p-6">
              {!isExecuting ? (
                // INPUT MODE
                <div className="flex flex-col gap-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--descriptor-color)]">
                    {hasInputs
                      ? lang === 'en'
                        ? 'Run with inputs:'
                        : 'Ejecutar con inputs:'
                      : text.description}
                  </div>
                  {hasInputs ? (
                    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                      {inputs.map(input => (
                        <InputField
                          key={input.name}
                          input={input}
                          value={formValues[input.name]}
                          onChange={v => setFormValues(prev => ({ ...prev, [input.name]: v }))}
                        />
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={jsonInput}
                      onChange={e => setJsonInput(e.target.value)}
                      className="h-48 w-full resize-none rounded-lg border border-[var(--border-color)] bg-[rgba(0,0,0,0.3)] p-3 font-mono text-sm text-[var(--body-text-color)] shadow-inner transition-colors focus:border-[var(--highlight-color)] focus:outline-none"
                      spellCheck="false"
                    />
                  )}
                  {error && (
                    <div className="flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                      <X size={12} /> {error}
                    </div>
                  )}
                </div>
              ) : (
                // EXECUTION MODE (MAGIC RUN)
                <div className="flex flex-col gap-6">
                  {/* Progress Bar */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.1)]">
                    <div
                      className="from-primary absolute left-0 top-0 h-full bg-gradient-to-r to-green-400 transition-all duration-300"
                      style={{
                        width: '100%',
                        animation: 'progress-indeterminate 2s infinite linear',
                      }}
                    />
                    <style jsx>{`
                      @keyframes progress-indeterminate {
                        0% {
                          left: -100%;
                          width: 50%;
                        }
                        50% {
                          left: 25%;
                          width: 50%;
                        }
                        100% {
                          left: 100%;
                          width: 50%;
                        }
                      }
                    `}</style>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center rounded border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] p-3">
                      <span className="mb-1 text-[10px] font-bold uppercase text-[var(--descriptor-color)]">
                        {text.jobId}
                      </span>
                      <span className="font-mono text-sm text-[var(--highlight-color)]">
                        {executionId ? `J-${executionId.slice(0, 8)}` : 'Init...'}
                      </span>
                    </div>
                    <div className="flex flex-col items-center rounded border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] p-3">
                      <span className="mb-1 text-[10px] font-bold uppercase text-[var(--descriptor-color)]">
                        {text.status}
                      </span>
                      <span className="animate-pulse text-sm font-bold text-green-400">
                        RUNNING
                      </span>
                    </div>
                    <div className="flex flex-col items-center rounded border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] p-3">
                      <span className="mb-1 text-[10px] font-bold uppercase text-[var(--descriptor-color)]">
                        {text.elapsed}
                      </span>
                      <span className="font-mono text-sm text-white">{elapsed.toFixed(1)}s</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between rounded border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] p-3 px-6">
                      <span className="text-xs font-bold uppercase text-[var(--descriptor-color)]">
                        {text.cpu}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-gray-700">
                          <div
                            className="bg-primary h-full transition-all duration-500"
                            style={{ width: cpuUsage }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-xs text-white">
                          {cpuUsage}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] p-3 px-6">
                      <span className="text-xs font-bold uppercase text-[var(--descriptor-color)]">
                        {text.mem}
                      </span>
                      <span className="font-mono text-sm text-white">{memUsage}</span>
                    </div>
                  </div>

                  {/* Latest Log */}
                  <div className="h-32 overflow-y-auto rounded border border-[var(--border-color)] bg-black/40 p-3 font-mono text-xs text-gray-300">
                    {logs.slice(-5).map((log, i) => {
                      const isError =
                        log.message.toLowerCase().includes('error') ||
                        log.message.toLowerCase().includes('fail');
                      return (
                        <div
                          key={i}
                          className="mb-1 border-b border-white/5 pb-1 last:border-0 last:pb-0"
                        >
                          <span className="mr-2 text-[var(--descriptor-color)]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={isError ? 'text-red-400' : 'text-gray-300'}>
                            {log.message}
                          </span>
                        </div>
                      );
                    })}
                    {logs.length === 0 && (
                      <span className="italic opacity-50">Initializing execution context...</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer (Buttons) */}
            <div className="flex justify-end gap-3 border-t border-[var(--border-color)] bg-[rgba(0,0,0,0.2)] p-4">
              {!isExecuting && (
                <button
                  className="rounded px-6 py-2 text-sm font-medium text-[var(--body-text-color)] transition-colors hover:bg-white/5"
                  onClick={onClose}
                >
                  {text.cancel}
                </button>
              )}
              {!isExecuting ? (
                <button
                  className="shadow-[var(--theme-color)]/20 flex items-center gap-2 rounded bg-[var(--theme-color)] px-6 py-2 text-sm font-bold text-white shadow-lg transition-all hover:brightness-110"
                  onClick={handleRunClick}
                >
                  <Play size={14} fill="currentColor" />
                  {text.run}
                </button>
              ) : (
                <button
                  className="rounded border border-red-500/50 bg-red-500/20 px-6 py-2 text-sm font-bold text-red-400 transition-all hover:bg-red-500/30"
                  onClick={onClose}
                >
                  Stop Execution
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function InputField({
  input,
  value,
  onChange,
}: {
  input: RunbookInputDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const fieldCls =
    'w-full bg-black/30 border border-[var(--border-color)] rounded px-3 py-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors';
  const label = input.label || input.name;

  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
        {input.required && <span className="text-red-400">*</span>}
        <code className="ml-auto font-mono text-[10px] normal-case text-slate-600">
          {input.name}
        </code>
      </label>
      {input.type === 'boolean' ? (
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-xs text-slate-400">{value ? 'true' : 'false'}</span>
        </label>
      ) : input.type === 'select' ? (
        <select
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          className={fieldCls}
        >
          {!input.required && <option value="">—</option>}
          {(input.options ?? []).map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={input.type === 'number' ? 'number' : 'text'}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={e => onChange(e.target.value)}
          className={`${fieldCls} ${input.type === 'number' ? 'font-mono' : ''}`}
        />
      )}
      {input.description && (
        <p className="mt-1 text-[10px] leading-snug text-slate-500">{input.description}</p>
      )}
    </div>
  );
}
