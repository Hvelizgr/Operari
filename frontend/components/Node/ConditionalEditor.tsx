'use client';

import { GitBranch } from 'lucide-react';

interface ConditionalEditorProps {
    lang: 'en' | 'es';
    runIf: string | undefined;
    skipIf: string | undefined;
    onChange: (next: { runIf?: string; skipIf?: string }) => void;
}

const STRINGS: Record<'en' | 'es', Record<string, string>> = {
    en: {
        title: 'Conditional execution',
        subtitle: 'Skip this step at runtime based on a template expression.',
        runIfLabel: 'Run if',
        runIfHint: 'Step runs only when this expression is truthy. Example: {{vars.environment}} == "prod"',
        skipIfLabel: 'Skip if',
        skipIfHint: 'Inverse of run if. Example: {{vars.dryRun}}',
        bothNote: 'When both are set, skip if takes precedence.',
    },
    es: {
        title: 'Ejecución condicional',
        subtitle: 'Omite este paso en tiempo de ejecución según una expresión.',
        runIfLabel: 'Ejecutar si',
        runIfHint: 'El paso solo se ejecuta si la expresión es verdadera. Ejemplo: {{vars.environment}} == "prod"',
        skipIfLabel: 'Omitir si',
        skipIfHint: 'Inverso de ejecutar si. Ejemplo: {{vars.dryRun}}',
        bothNote: 'Si ambos están definidos, "omitir si" tiene prioridad.',
    },
};

export default function ConditionalEditor({ lang, runIf, skipIf, onChange }: ConditionalEditorProps) {
    const t = STRINGS[lang] ?? STRINGS.en;
    const inputClass =
        'w-full bg-black/20 border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors font-mono';

    return (
        <div>
            <h3 className="text-[12px] font-bold uppercase text-[var(--highlight-color)] mb-1 flex items-center gap-2">
                <GitBranch size={12} />
                {t.title}
            </h3>
            <p className="text-[11px] text-[var(--descriptor-color)] mb-3 leading-tight">{t.subtitle}</p>

            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase text-[var(--descriptor-color)]">
                        {t.runIfLabel}
                    </label>
                    <input
                        type="text"
                        value={runIf ?? ''}
                        placeholder='{{vars.environment}} == "prod"'
                        onChange={(e) => onChange({ runIf: e.target.value || undefined, skipIf })}
                        className={inputClass}
                    />
                    <p className="text-[10px] text-[var(--descriptor-color)] opacity-70 leading-tight">
                        {t.runIfHint}
                    </p>
                </div>

                <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase text-[var(--descriptor-color)]">
                        {t.skipIfLabel}
                    </label>
                    <input
                        type="text"
                        value={skipIf ?? ''}
                        placeholder="{{vars.dryRun}}"
                        onChange={(e) => onChange({ runIf, skipIf: e.target.value || undefined })}
                        className={inputClass}
                    />
                    <p className="text-[10px] text-[var(--descriptor-color)] opacity-70 leading-tight">
                        {t.skipIfHint}
                    </p>
                </div>

                {runIf && skipIf && (
                    <p className="text-[10px] text-amber-400 italic">{t.bothNote}</p>
                )}
            </div>
        </div>
    );
}
