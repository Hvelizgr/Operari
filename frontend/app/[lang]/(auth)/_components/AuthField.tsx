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
            <span className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                {label}
            </span>
            <input
                {...rest}
                value={value}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                className="w-full rounded-lg bg-background/60 border border-border/70 px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            />
            {hint && (
                <span className="mt-1.5 block text-[11px] text-muted-foreground/80">{hint}</span>
            )}
        </label>
    );
}
