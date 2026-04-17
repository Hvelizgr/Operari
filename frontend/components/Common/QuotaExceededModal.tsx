'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Zap } from 'lucide-react';

export interface QuotaExceededPayload {
    resource: string;
    current: number;
    limit: number;
    upgrade?: string;
}

const STRINGS = {
    en: {
        title: 'You hit your plan limit',
        body: (resource: string, current: number, limit: number) =>
            `Plan caps ${resource} at ${limit}. You tried to go past ${current}. Upgrade to Team for $19/user/month or Business for $49.`,
        upgrade: 'Go to billing',
        cancel: 'Dismiss',
    },
    es: {
        title: 'Alcanzaste el límite del plan',
        body: (resource: string, current: number, limit: number) =>
            `El plan permite ${limit} ${resource}. Intentaste superar ${current}. Cambiá a Team ($19/user/mes) o Business ($49).`,
        upgrade: 'Ir a facturación',
        cancel: 'Cerrar',
    },
} as const;

/**
 * Global modal that renders when the backend returns 402 with a
 * quota shape. Fetch-layer glue in `QuotaInterceptor` pushes events
 * onto a module-level event emitter; this component subscribes and
 * shows the modal. Decoupled so any page that already uses `fetch`
 * directly still benefits without touching its call sites.
 */

type Listener = (payload: QuotaExceededPayload) => void;
const listeners = new Set<Listener>();

export function emitQuotaExceeded(payload: QuotaExceededPayload): void {
    listeners.forEach((l) => l(payload));
}

export function QuotaExceededModal({ lang }: { lang: 'en' | 'es' }) {
    const t = STRINGS[lang];
    const [payload, setPayload] = useState<QuotaExceededPayload | null>(null);

    useEffect(() => {
        const handler: Listener = (p) => setPayload(p);
        listeners.add(handler);
        return () => {
            listeners.delete(handler);
        };
    }, []);

    if (!payload) return null;

    const upgradeHref = `/${lang}/settings?plan=team`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
                <button
                    onClick={() => setPayload(null)}
                    aria-label={t.cancel}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                >
                    <X className="w-4 h-4" />
                </button>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    <Zap className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">{t.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {t.body(payload.resource, payload.current, payload.limit)}
                </p>
                <div className="flex items-center gap-3">
                    <Link
                        href={upgradeHref}
                        onClick={() => setPayload(null)}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-md shadow-primary/20 hover:bg-primary/90"
                    >
                        <Zap className="w-4 h-4" />
                        {t.upgrade}
                    </Link>
                    <button
                        onClick={() => setPayload(null)}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        {t.cancel}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Install a global fetch wrapper that watches for 402 responses and
 * emits a QuotaExceeded event when the body matches our shape.
 * Mount once in the root layout.
 */
export function QuotaInterceptor() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const original = window.fetch;
        if ((original as unknown as { __cairnQuota?: boolean }).__cairnQuota) return;

        const wrapped = async (input: RequestInfo | URL, init?: RequestInit) => {
            const res = await original(input, init);
            if (res.status === 402) {
                try {
                    // Clone so the real consumer still gets a fresh body.
                    const clone = res.clone();
                    const body = await clone.json();
                    if (
                        body &&
                        typeof body.resource === 'string' &&
                        typeof body.current === 'number' &&
                        typeof body.limit === 'number'
                    ) {
                        emitQuotaExceeded({
                            resource: body.resource,
                            current: body.current,
                            limit: body.limit,
                            upgrade: body.upgrade,
                        });
                    }
                } catch {
                    // 402 without our shape → ignore silently.
                }
            }
            return res;
        };
        (wrapped as unknown as { __cairnQuota?: boolean }).__cairnQuota = true;
        window.fetch = wrapped as typeof window.fetch;
        return () => {
            window.fetch = original;
        };
    }, []);
    return null;
}
