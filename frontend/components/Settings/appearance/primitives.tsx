'use client';

import { Check, ArrowRight } from 'lucide-react';
import { STATUS_HEX_DEFAULTS, type StatusColors } from '@/context/VisualizationContext';

/* ─────────────────────────────────────────────────────────────
   Shared UI atoms used by every Appearance tab.
   Each primitive is deliberately small and unopinionated — the tab
   files compose them, the tabs don't own styling. Any change to the
   visual language lives here.
   ───────────────────────────────────────────────────────────── */

export function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-4">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--text-muted)]">
        {icon}
        <span>{title}</span>
      </div>
      {hint && <p className="mb-3 text-[11px] text-[var(--text-muted)]">{hint}</p>}
      {children}
    </div>
  );
}

export function TabButton({
  icon,
  active,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? 'border-[var(--accent-color)] text-[var(--text-primary)]'
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)] text-[var(--text-primary)]'
          : 'hover:border-[var(--accent-color)]/40 border-[var(--panel-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

export function PillGroup<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <PillButton key={String(opt.id)} active={value === opt.id} onClick={() => onChange(opt.id)}>
          {opt.label}
        </PillButton>
      ))}
    </div>
  );
}

export function ToggleRow({
  label,
  value,
  onChange,
  on,
  off,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  on: string;
  off: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="text-sm text-[var(--text-primary)]">{label}</div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          value ? 'bg-[var(--accent-color)]' : 'bg-[var(--panel-border)]'
        }`}
        aria-label={value ? on : off}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          } translate-y-0.5`}
        />
      </button>
    </div>
  );
}

export function SliderRow({
  title,
  hint,
  value,
  min,
  max,
  step,
  unit,
  format,
  onChange,
  bare,
}: {
  title: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (next: number) => void;
  /** When true, skip the Section card wrapper — useful for nesting
   *  a slider inside an already-captioned Section (e.g. arrow size
   *  conditionally shown under the arrow toggle). */
  bare?: boolean;
}) {
  const display = format ? format(value) : `${value}${unit ?? ''}`;
  const inner = (
    <>
      <div className="flex items-center justify-between text-sm text-[var(--text-primary)]">
        <span>{title}</span>
        <span className="font-mono text-xs text-[var(--text-muted)]">{display}</span>
      </div>
      {hint && <div className="mb-2 mt-0.5 text-[11px] text-[var(--text-muted)]">{hint}</div>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[var(--accent-color)]"
      />
    </>
  );
  if (bare) {
    return <div className="mt-3">{inner}</div>;
  }
  return (
    <div className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-4">
      {inner}
    </div>
  );
}

export function PreviewCard({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`group relative flex flex-col items-stretch gap-1.5 rounded-md border p-2 text-left transition-colors ${
        active
          ? 'bg-[var(--accent-color)]/5 border-[var(--accent-color)]'
          : 'hover:border-[var(--accent-color)]/40 border-[var(--panel-border)]'
      }`}
    >
      <div className="bg-[var(--app-bg)]/70 flex h-16 items-center justify-center overflow-hidden rounded px-2">
        {children}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--text-primary)]">{label}</span>
        {active && <Check size={11} className="text-[var(--accent-color)]" />}
      </div>
    </button>
  );
}

export function StatusColorRow({
  label,
  statusKey,
  value,
  onChange,
  resetLabel,
}: {
  label: string;
  statusKey: keyof StatusColors;
  value: string | null;
  onChange: (next: string | null) => void;
  resetLabel: string;
}) {
  const effective = value ?? STATUS_HEX_DEFAULTS[statusKey];
  const isCustom = value !== null;
  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="color"
          value={effective}
          onChange={e => onChange(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border border-[var(--panel-border)] bg-transparent"
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-[var(--text-primary)]">{label}</div>
          <div className="font-mono text-[10px] text-[var(--text-muted)]">{effective}</div>
        </div>
      </div>
      {isCustom && (
        <button
          onClick={() => onChange(null)}
          className="rounded px-2 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {resetLabel}
        </button>
      )}
    </div>
  );
}

export function PresetCard({
  name,
  description,
  onApply,
  applyLabel,
  accent,
}: {
  name: string;
  description: string;
  onApply: () => void;
  applyLabel: string;
  accent: string;
}) {
  return (
    <button
      onClick={onApply}
      className="hover:border-[var(--accent-color)]/50 group flex items-start gap-3 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 text-left transition-colors"
    >
      <span
        className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-md"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}66 100%)`,
          boxShadow: `0 0 12px ${accent}55`,
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--text-primary)]">{name}</div>
        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{description}</div>
      </div>
      <ArrowRight
        size={14}
        className="mt-1 flex-shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
      />
      <span className="sr-only">{applyLabel}</span>
    </button>
  );
}
