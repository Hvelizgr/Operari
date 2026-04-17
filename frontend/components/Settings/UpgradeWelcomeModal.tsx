'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

const STRINGS = {
    en: {
        title: 'Welcome to the paid club.',
        subtitle: "Your subscription is live. Here's what just unlocked:",
        bullets: [
            'Unlimited runbooks and unlimited runs per month',
            'Invite unlimited teammates with role-based permissions',
            'Priority email support and managed Postgres backups (Team)',
            'SAML SSO, SCIM, and audit log export (Business)',
        ],
        dismiss: 'Start building',
    },
    es: {
        title: 'Bienvenido al club pago.',
        subtitle: 'Tu suscripción está activa. Esto es lo que acabás de desbloquear:',
        bullets: [
            'Runbooks ilimitados y runs ilimitados por mes',
            'Invitá ilimitados miembros con permisos por rol',
            'Soporte prioritario y backups gestionados de Postgres (Team)',
            'SAML SSO, SCIM, y export de audit log (Business)',
        ],
        dismiss: 'Empezar',
    },
} as const;

/**
 * Celebratory modal shown once after Stripe Checkout redirects back
 * to `/settings?checkout=success`. Anchors the value of the upgrade
 * so the user leaves the payment flow knowing what they bought.
 *
 * Stripping the query param on dismiss prevents the modal from
 * firing again on reload.
 */
export function UpgradeWelcomeModal({ lang }: { lang: 'en' | 'es' }) {
    const t = STRINGS[lang];
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('checkout') === 'success') setOpen(true);
    }, []);

    function dismiss() {
        setOpen(false);
        const params = new URLSearchParams(window.location.search);
        params.delete('checkout');
        const remaining = params.toString();
        const newUrl = window.location.pathname + (remaining ? `?${remaining}` : '');
        window.history.replaceState({}, '', newUrl);
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-primary/40 bg-card p-6 shadow-2xl">
                <button
                    onClick={dismiss}
                    aria-label="Dismiss"
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                >
                    <X className="w-4 h-4" />
                </button>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 border border-primary/40 text-primary">
                    <Check className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">{t.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{t.subtitle}</p>
                <ul className="space-y-2.5 mb-6">
                    {t.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/90">
                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span className="leading-snug">{b}</span>
                        </li>
                    ))}
                </ul>
                <button
                    onClick={dismiss}
                    className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 shadow-md shadow-primary/20"
                >
                    {t.dismiss}
                </button>
            </div>
        </div>
    );
}
