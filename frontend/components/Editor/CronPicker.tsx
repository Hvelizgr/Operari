'use client';

import { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

interface CronPickerProps {
    lang: 'en' | 'es';
    value: string | null;
    onChange: (next: string | null) => void;
}

const PRESETS: Array<{ key: string; expr: string }> = [
    { key: 'off', expr: '' },
    { key: 'everyMinute', expr: '* * * * *' },
    { key: 'every5Minutes', expr: '*/5 * * * *' },
    { key: 'every15Minutes', expr: '*/15 * * * *' },
    { key: 'hourly', expr: '0 * * * *' },
    { key: 'daily', expr: '0 9 * * *' },
    { key: 'weekly', expr: '0 9 * * 1' },
    { key: 'monthly', expr: '0 9 1 * *' },
    { key: 'custom', expr: 'CUSTOM' },
];

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
    en: {
        title: 'Schedule',
        subtitle: 'How often the runbook should run automatically.',
        off: 'Off',
        everyMinute: 'Every minute',
        every5Minutes: 'Every 5 minutes',
        every15Minutes: 'Every 15 minutes',
        hourly: 'Hourly',
        daily: 'Daily at 09:00',
        weekly: 'Weekly (Mon 09:00)',
        monthly: 'Monthly (1st 09:00)',
        custom: 'Custom expression',
        customLabel: 'Cron expression',
        customPlaceholder: '0 9 * * 1-5',
        invalid: 'Invalid cron expression',
        valid: 'Valid: 5 fields',
    },
    es: {
        title: 'Programación',
        subtitle: 'Con qué frecuencia se ejecuta el runbook automáticamente.',
        off: 'Apagado',
        everyMinute: 'Cada minuto',
        every5Minutes: 'Cada 5 minutos',
        every15Minutes: 'Cada 15 minutos',
        hourly: 'Cada hora',
        daily: 'Diario a las 09:00',
        weekly: 'Semanal (lun 09:00)',
        monthly: 'Mensual (día 1 09:00)',
        custom: 'Expresión personalizada',
        customLabel: 'Expresión cron',
        customPlaceholder: '0 9 * * 1-5',
        invalid: 'Expresión cron inválida',
        valid: 'Válida: 5 campos',
    },
};

/**
 * Lightweight cron validator. The backend's scheduler library is the
 * source of truth, but a 5-field shape check is enough to flag typos
 * before the user saves the runbook.
 */
function validateCron(expr: string): boolean {
    if (!expr) return true;
    const fields = expr.trim().split(/\s+/);
    if (fields.length !== 5) return false;
    const fieldRe = /^[\d*/,\-]+$/;
    return fields.every((f) => fieldRe.test(f));
}

export default function CronPicker({ lang, value, onChange }: CronPickerProps) {
    const t = STRINGS[lang] ?? STRINGS.en;

    const initialPreset = useMemo(() => {
        if (!value) return 'off';
        const preset = PRESETS.find((p) => p.expr === value);
        return preset ? preset.key : 'custom';
    }, [value]);

    const [preset, setPreset] = useState(initialPreset);
    const [customExpr, setCustomExpr] = useState(
        initialPreset === 'custom' ? value ?? '' : ''
    );

    const isValid = preset === 'custom' ? validateCron(customExpr) : true;

    const selectPreset = (key: string) => {
        setPreset(key);
        const found = PRESETS.find((p) => p.key === key);
        if (!found) return;
        if (key === 'off') {
            onChange(null);
        } else if (key === 'custom') {
            onChange(customExpr || null);
        } else {
            onChange(found.expr);
        }
    };

    const updateCustom = (expr: string) => {
        setCustomExpr(expr);
        if (preset === 'custom') {
            onChange(expr || null);
        }
    };

    return (
        <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                <Clock size={12} className="inline mr-1" />
                {t.title}
            </label>
            <p className="text-[10px] text-slate-500 mb-2">{t.subtitle}</p>

            <div className="grid grid-cols-2 gap-1 mb-2">
                {PRESETS.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => selectPreset(p.key)}
                        className={`rounded border px-2 py-1.5 text-[11px] text-left transition ${
                            preset === p.key
                                ? 'border-primary bg-primary/10 text-primary/20'
                                : 'border-slate-700 bg-black/20 text-slate-300 hover:border-slate-500'
                        }`}
                    >
                        {t[p.key]}
                    </button>
                ))}
            </div>

            {preset === 'custom' && (
                <div className="space-y-1">
                    <input
                        type="text"
                        value={customExpr}
                        onChange={(e) => updateCustom(e.target.value)}
                        placeholder={t.customPlaceholder}
                        className={`w-full bg-black/20 border rounded p-2 text-sm text-slate-100 focus:outline-none font-mono ${
                            customExpr && !isValid
                                ? 'border-red-500 focus:border-red-400'
                                : 'border-slate-700 focus:border-slate-500'
                        }`}
                    />
                    {customExpr && (
                        <p
                            className={`text-[10px] ${
                                isValid ? 'text-emerald-400' : 'text-red-400'
                            }`}
                        >
                            {isValid ? t.valid : t.invalid}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
