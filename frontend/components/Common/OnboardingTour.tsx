'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutTemplate, Workflow, FlaskConical, Rocket, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const STORAGE_KEY = 'nanorun_tour_completed';

const STRINGS = {
    en: {
        title: 'Get your first runbook live in 4 steps',
        skip: 'Skip tour',
        next: 'Next',
        back: 'Back',
        finish: 'Let\'s go',
        stepLabel: (n: number, total: number) => `Step ${n} of ${total}`,
        steps: [
            {
                heading: 'Start from a template',
                body: 'Restart a stuck service, rotate a key, drain a node — pick one of our vetted runbooks instead of a blank canvas.',
                cta: 'Browse templates',
                href: '/templates',
            },
            {
                heading: 'Edit visually',
                body: 'Drag nodes on the canvas, wire them together, and set inputs. No YAML, no Jinja soup — just boxes and arrows.',
                cta: 'Open the editor',
                href: '/editor',
            },
            {
                heading: 'Dry-run first',
                body: 'Every run has a dry-run toggle. Shell commands echo, HTTP calls short-circuit, approvals auto-pass. Prove the shape before touching prod.',
                cta: null,
                href: null,
            },
            {
                heading: 'Run for real',
                body: 'Happy with the dry-run? Flip the toggle and execute. Every step is audit-logged and every run replays from the inbox.',
                cta: 'Go to dashboard',
                href: '/dashboard',
            },
        ],
    },
    es: {
        title: 'Tu primer runbook en 4 pasos',
        skip: 'Saltar tour',
        next: 'Siguiente',
        back: 'Atrás',
        finish: 'Vamos',
        stepLabel: (n: number, total: number) => `Paso ${n} de ${total}`,
        steps: [
            {
                heading: 'Empezá con un template',
                body: 'Reiniciar un servicio, rotar una key, drenar un nodo — elegí un runbook verificado en lugar de empezar en blanco.',
                cta: 'Ver templates',
                href: '/templates',
            },
            {
                heading: 'Edita visualmente',
                body: 'Arrastrá nodos en el canvas, conectalos y seteá los inputs. Sin YAML, sin Jinja — solo cajas y flechas.',
                cta: 'Abrir el editor',
                href: '/editor',
            },
            {
                heading: 'Dry-run primero',
                body: 'Cada run tiene un toggle de dry-run. Los shell commands se imprimen, los HTTP no salen, los approvals pasan solos. Probá antes de tocar prod.',
                cta: null,
                href: null,
            },
            {
                heading: 'Ahora sí, ejecutá',
                body: '¿Todo bien en dry-run? Apagá el toggle y corré. Cada paso queda auditado y cada run se puede replay desde el inbox.',
                cta: 'Ir al dashboard',
                href: '/dashboard',
            },
        ],
    },
} as const;

const ICONS = [LayoutTemplate, Workflow, FlaskConical, Rocket];

/**
 * Four-step first-run walkthrough. Shown once on the dashboard when a
 * user has never seen it before — localStorage gate keeps it out of the
 * way on every subsequent visit.
 *
 * Skipped in anonymous self-host mode because there's no per-user
 * state to persist the completion against.
 */
export function OnboardingTour({ lang }: { lang: 'en' | 'es' }) {
    const t = STRINGS[lang];
    const { session } = useAuth();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!session) return;
        if (session.user.id === 'anonymous') return;
        if (window.localStorage.getItem(STORAGE_KEY) === '1') return;
        setOpen(true);
    }, [session]);

    function close() {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, '1');
        }
        setOpen(false);
    }

    if (!open) return null;

    const total = t.steps.length;
    const current = t.steps[step];
    const Icon = ICONS[step] ?? LayoutTemplate;
    const isLast = step === total - 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-primary/40 bg-card p-6 shadow-2xl">
                <button
                    onClick={close}
                    aria-label={t.skip}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="mb-5">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                        {t.stepLabel(step + 1, total)}
                    </p>
                    <h2 className="text-xl font-bold text-foreground">{t.title}</h2>
                </div>

                <div className="mb-6 flex items-start gap-4 rounded-xl border border-[var(--border-color,rgba(255,255,255,0.08))] bg-[rgba(255,255,255,0.02)] p-4">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 border border-primary/40 text-primary">
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground mb-1">
                            {current.heading}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {current.body}
                        </p>
                        {current.cta && current.href && (
                            <Link
                                href={current.href}
                                onClick={close}
                                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                            >
                                {current.cta}
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        )}
                    </div>
                </div>

                <div className="mb-5 flex items-center gap-1.5">
                    {t.steps.map((_, i) => (
                        <span
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                                i <= step ? 'bg-primary' : 'bg-[rgba(255,255,255,0.1)]'
                            }`}
                        />
                    ))}
                </div>

                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={close}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        {t.skip}
                    </button>
                    <div className="flex items-center gap-2">
                        {step > 0 && (
                            <button
                                onClick={() => setStep((s) => Math.max(0, s - 1))}
                                className="h-9 rounded-lg border border-[var(--border-color,rgba(255,255,255,0.15))] px-4 text-sm text-foreground/80 hover:text-foreground hover:border-primary/50"
                            >
                                {t.back}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (isLast) close();
                                else setStep((s) => Math.min(total - 1, s + 1));
                            }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
                        >
                            {isLast ? t.finish : t.next}
                            {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
