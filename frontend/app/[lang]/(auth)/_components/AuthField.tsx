'use client';

import type { ChangeEvent, InputHTMLAttributes } from 'react';

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}

export function AuthField({ label, hint, value, onChange, ...rest }: AuthFieldProps) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1.5 block font-mono text-[11px] uppercase tracking-widest">
        {label}
      </span>
      <input
        {...rest}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="bg-background/60 border-border/70 text-foreground placeholder-muted-foreground/60 focus:border-primary/60 focus:ring-primary/20 w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2"
      />
      {hint && <span className="text-muted-foreground/80 mt-1.5 block text-[11px]">{hint}</span>}
    </label>
  );
}
