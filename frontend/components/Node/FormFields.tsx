'use client';

import { CalendarClock, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const STRINGS = {
  en: {
    invalidJson: 'Not valid JSON',
    pick: 'Pick date and time',
    key: 'Key',
    value: 'Value',
    add: 'Add',
    remove: 'Remove',
  },
  es: {
    invalidJson: 'JSON inválido',
    pick: 'Elegir fecha y hora',
    key: 'Clave',
    value: 'Valor',
    add: 'Agregar',
    remove: 'Quitar',
  },
} as const;

type Lang = 'en' | 'es';

const hasTemplate = (s: string) => s.includes('{{');

/** JSON text with a live check; text containing a template is not checked. */
export function JsonField({
  lang,
  value,
  onChange,
  rows = 4,
  className,
}: {
  lang: Lang;
  value: unknown;
  onChange: (next: string) => void;
  rows?: number;
  className: string;
}) {
  const text =
    typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value, null, 2);
  let invalid = false;
  if (text.trim() && !hasTemplate(text)) {
    try {
      JSON.parse(text);
    } catch {
      invalid = true;
    }
  }
  return (
    <div>
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        spellCheck={false}
        className={`${className} font-mono ${invalid ? 'border-red-500/60' : ''}`}
        aria-invalid={invalid}
      />
      {invalid && <p className="mt-0.5 text-[11px] text-red-400">{STRINGS[lang].invalidJson}</p>}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * ISO 8601 text plus a picker that fills it. The text stays editable so an
 * expression ({{vars.when}}) or a hand-written timestamp still works.
 */
export function DateTimeField({
  lang,
  value,
  onChange,
  className,
}: {
  lang: Lang;
  value: string;
  onChange: (next: string) => void;
  className: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="2026-11-04T09:30:00.000Z"
        className={className}
      />
      <label
        className="relative shrink-0 cursor-pointer rounded p-1.5 text-[var(--descriptor-color)] hover:bg-white/10"
        title={STRINGS[lang].pick}
      >
        <CalendarClock size={14} />
        <input
          type="datetime-local"
          aria-label={STRINGS[lang].pick}
          value={hasTemplate(value) ? '' : toLocalInput(value)}
          onChange={e => {
            const d = new Date(e.target.value);
            if (!Number.isNaN(d.getTime())) onChange(d.toISOString());
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

type Row = { key: string; value: string };

function rowsFrom(value: unknown): Row[] {
  let obj: unknown = value;
  if (typeof value === 'string') {
    try {
      obj = value.trim() ? JSON.parse(value) : {};
    } catch {
      obj = {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj as Record<string, unknown>).map(([key, v]) => ({
    key,
    value: typeof v === 'string' ? v : JSON.stringify(v),
  }));
}

/** An object edited as key/value rows; empty keys are left out. */
export function KeyValueField({
  lang,
  value,
  onChange,
  className,
}: {
  lang: Lang;
  value: unknown;
  onChange: (next: Record<string, string>) => void;
  className: string;
}) {
  const t = STRINGS[lang];
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(value));
  useEffect(() => {
    const incoming = rowsFrom(value);
    const current = Object.fromEntries(rows.filter(r => r.key).map(r => [r.key, r.value]));
    if (
      JSON.stringify(Object.fromEntries(incoming.map(r => [r.key, r.value]))) !==
      JSON.stringify(current)
    ) {
      setRows(incoming);
    }
    // Only resync when the stored value changes from outside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  const commit = (next: Row[]) => {
    setRows(next);
    onChange(Object.fromEntries(next.filter(r => r.key.trim()).map(r => [r.key.trim(), r.value])));
  };

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            aria-label={t.key}
            placeholder={t.key}
            value={row.key}
            onChange={e =>
              commit(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))
            }
            className={`${className} w-2/5 font-mono`}
          />
          <input
            aria-label={t.value}
            placeholder={t.value}
            value={row.value}
            onChange={e =>
              commit(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
            }
            className={`${className} flex-1`}
          />
          <button
            type="button"
            aria-label={t.remove}
            title={t.remove}
            onClick={() => commit(rows.filter((_, j) => j !== i))}
            className="rounded p-1 text-[var(--descriptor-color)] hover:bg-white/10"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { key: '', value: '' }])}
        className="inline-flex items-center gap-1 text-[11px] text-[var(--descriptor-color)] hover:text-[var(--body-text-color)]"
      >
        <Plus size={12} /> {t.add}
      </button>
    </div>
  );
}
