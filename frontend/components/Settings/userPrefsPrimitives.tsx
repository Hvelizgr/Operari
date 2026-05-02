'use client';

import type React from 'react';

/**
 * Tiny shared primitives used across SqlPrefsPanel, ApiPrefsPanel,
 * EditorPrefsPanel and LineagePrefsPanel. Each one is a labeled row
 * with a lightweight control on the right. Kept in a single file so
 * the panels themselves stay focused on the prefs they own.
 */

export function Toggle({
  icon,
  label,
  hint,
  value,
  onChange,
  on,
  off,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  on: string;
  off: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--panel-border)] bg-[var(--app-bg)] p-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {icon ? <span className="text-[var(--text-muted)]">{icon}</span> : null}
          {label}
        </div>
        {hint ? <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{hint}</div> : null}
      </div>
      <div className="flex shrink-0 overflow-hidden rounded border border-[var(--panel-border)]">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-2 py-1 text-[10px] uppercase tracking-wide ${!value ? 'bg-zinc-700 text-white' : 'text-[var(--text-muted)]'}`}
        >
          {off}
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-2 py-1 text-[10px] uppercase tracking-wide ${value ? 'bg-emerald-600 text-white' : 'text-[var(--text-muted)]'}`}
        >
          {on}
        </button>
      </div>
    </div>
  );
}

export function NumberSlider({
  icon,
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-md border border-[var(--panel-border)] bg-[var(--app-bg)] p-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {icon ? <span className="text-[var(--text-muted)]">{icon}</span> : null}
            {label}
          </div>
          {hint ? <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{hint}</div> : null}
        </div>
        <span className="font-mono text-xs text-emerald-400">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-emerald-500"
      />
    </div>
  );
}

export function Pills<T extends string | number>({
  icon,
  label,
  hint,
  value,
  options,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="rounded-md border border-[var(--panel-border)] bg-[var(--app-bg)] p-2">
      <div className="mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {icon ? <span className="text-[var(--text-muted)]">{icon}</span> : null}
          {label}
        </div>
        {hint ? <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{hint}</div> : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => {
          const active = value === opt.id;
          return (
            <button
              key={String(opt.id)}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`rounded border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors ${
                active
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-[var(--panel-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TextInput({
  icon,
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-md border border-[var(--panel-border)] bg-[var(--app-bg)] p-2">
      <div className="mb-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {icon ? <span className="text-[var(--text-muted)]">{icon}</span> : null}
          {label}
        </div>
        {hint ? <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{hint}</div> : null}
      </div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded border border-[var(--panel-border)] bg-black/30 px-2 py-1 font-mono text-[11px] text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none"
      />
    </div>
  );
}
