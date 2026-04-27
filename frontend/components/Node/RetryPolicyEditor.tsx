'use client';

import { RotateCcw } from 'lucide-react';

import type { RetryPolicy } from '@/utils/runbookYaml';

interface RetryPolicyEditorProps {
  lang: 'en' | 'es';
  value: RetryPolicy | undefined;
  onChange: (next: RetryPolicy | undefined) => void;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
  en: {
    title: 'Retry policy',
    subtitle: 'How Operari should react if this step fails.',
    enable: 'Enable retries',
    count: 'Attempts',
    countHint: 'Extra attempts after the first failure (e.g. 3 = up to 4 total runs).',
    backoff: 'Backoff',
    backoffFixed: 'Fixed delay',
    backoffExp: 'Exponential',
    delay: 'Delay (ms)',
    delayHint: 'Wait before the next attempt. Exponential mode doubles each retry.',
    maxDelay: 'Max delay (ms)',
    maxDelayHint: 'Cap on exponential backoff growth.',
  },
  es: {
    title: 'Política de reintentos',
    subtitle: 'Cómo debe reaccionar Operari si este paso falla.',
    enable: 'Habilitar reintentos',
    count: 'Intentos',
    countHint: 'Intentos extra tras el primer fallo (3 = hasta 4 ejecuciones).',
    backoff: 'Espera entre intentos',
    backoffFixed: 'Fija',
    backoffExp: 'Exponencial',
    delay: 'Retraso (ms)',
    delayHint: 'Espera antes del siguiente intento. La exponencial duplica cada vez.',
    maxDelay: 'Máximo (ms)',
    maxDelayHint: 'Límite del crecimiento exponencial.',
  },
};

export default function RetryPolicyEditor({ lang, value, onChange }: RetryPolicyEditorProps) {
  const t = STRINGS[lang] ?? STRINGS.en;
  const enabled = value != null && value.count > 0;
  const policy: RetryPolicy = value ?? {
    count: 3,
    backoff: 'exponential',
    delayMs: 1000,
    maxDelayMs: 30000,
  };

  const update = (patch: Partial<RetryPolicy>) => {
    onChange({ ...policy, ...patch });
  };

  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-[12px] font-bold uppercase text-[var(--highlight-color)]">
        <RotateCcw size={12} />
        {t.title}
      </h3>
      <p className="mb-3 text-[11px] leading-tight text-[var(--descriptor-color)]">{t.subtitle}</p>

      <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs text-[var(--body-text-color)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => {
            if (e.target.checked) {
              onChange({ count: 3, backoff: 'exponential', delayMs: 1000, maxDelayMs: 30000 });
            } else {
              onChange(undefined);
            }
          }}
        />
        {t.enable}
      </label>

      {enabled && (
        <div className="border-[var(--highlight-color)]/40 space-y-3 border-l-2 pl-3">
          <Field label={t.count} hint={t.countHint}>
            <input
              type="number"
              min={1}
              max={20}
              value={policy.count}
              onChange={e => update({ count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className={inputClass}
            />
          </Field>

          <Field label={t.backoff}>
            <select
              value={policy.backoff ?? 'exponential'}
              onChange={e => update({ backoff: e.target.value as RetryPolicy['backoff'] })}
              className={inputClass}
            >
              <option value="fixed">{t.backoffFixed}</option>
              <option value="exponential">{t.backoffExp}</option>
            </select>
          </Field>

          <Field label={t.delay} hint={t.delayHint}>
            <input
              type="number"
              min={0}
              step={100}
              value={policy.delayMs ?? 1000}
              onChange={e => update({ delayMs: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className={inputClass}
            />
          </Field>

          {policy.backoff === 'exponential' && (
            <Field label={t.maxDelay} hint={t.maxDelayHint}>
              <input
                type="number"
                min={0}
                step={1000}
                value={policy.maxDelayMs ?? 30000}
                onChange={e =>
                  update({ maxDelayMs: Math.max(0, parseInt(e.target.value, 10) || 0) })
                }
                className={inputClass}
              />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

const inputClass =
  'w-full bg-black/20 border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors font-mono';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-bold uppercase text-[var(--descriptor-color)]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] leading-tight text-[var(--descriptor-color)] opacity-70">
          {hint}
        </p>
      )}
    </div>
  );
}
