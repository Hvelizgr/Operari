'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth, AuthError } from '@/lib/auth';
import { yamlToSpec, specToNodes } from '@/utils/runbookYaml';

interface UseTemplateButtonProps {
    slug: string;
    lang: 'en' | 'es';
    labelSignedIn: string;
    labelSignedOut: string;
    creatingLabel: string;
    errorLabel: string;
}

/**
 * Client-island for the "Use this runbook" CTA on the detail page.
 *
 * Two modes driven by session state:
 *   - signed-out: the button is a link to /register with the template
 *     slug preserved as a query param, so the signup handoff can pick
 *     it up and create the runbook right after the account is minted.
 *   - signed-in: POSTs the template's yaml body to the runbook create
 *     endpoint via a small intermediate route and redirects to the
 *     editor on success.
 *
 * Everything below relies on auth state resolved client-side — during
 * the initial loading phase we render a neutral "loading" button so
 * there's no flash of "sign up" for an authenticated user.
 */
export function UseTemplateButton({
    slug,
    lang,
    labelSignedIn,
    labelSignedOut,
    creatingLabel,
    errorLabel,
}: UseTemplateButtonProps) {
    const { session, loading } = useAuth();
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function createFromTemplate() {
        if (submitting) return;
        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch(`/api/templates/${encodeURIComponent(slug)}`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error(`failed to load template: ${res.status}`);
            const body = (await res.json()) as { data?: { yaml: string; name: string } };
            if (!body.data) throw new Error('no template payload');

            // Convert YAML → canvas shape BEFORE POST. The backend's
            // create endpoint doesn't deserialize YAML (that lives in
            // the runbook-serializer module used only by import paths),
            // so we run the same spec→nodes pipeline the editor's YAML
            // modal uses. Keeps the two import paths byte-identical.
            const spec = yamlToSpec(body.data.yaml);
            const parsed = specToNodes(spec);

            const createRes = await fetch('/api/runbooks', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: body.data.name,
                    description: `Imported from template: ${slug}`,
                    nodes: parsed.nodes,
                    connections: parsed.connections,
                }),
            });
            if (!createRes.ok) {
                throw new Error(`create failed: ${createRes.status}`);
            }
            const created = (await createRes.json()) as { id?: string };
            if (!created.id) throw new Error('create returned no id');
            router.push(`/${lang}/editor?runbook=${encodeURIComponent(created.id)}`);
        } catch (err) {
            if (err instanceof AuthError && err.status === 401) {
                router.push(`/${lang}/login?redirect=${encodeURIComponent(`/${lang}/templates/${slug}`)}`);
                return;
            }
            setError(errorLabel);
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <button
                disabled
                className="inline-flex items-center gap-2 rounded-lg bg-primary/50 text-primary-foreground px-5 py-3 font-semibold text-sm opacity-60 cursor-not-allowed"
            >
                <Loader2 className="w-4 h-4 animate-spin" />
                {creatingLabel}
            </button>
        );
    }

    if (!session) {
        return (
            <a
                href={`/${lang}/register?template=${encodeURIComponent(slug)}`}
                className="group inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-3 font-semibold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all"
            >
                {labelSignedOut}
                <ArrowRight className="w-4 h-4 opacity-70 transition-transform group-hover:translate-x-0.5" />
            </a>
        );
    }

    return (
        <div className="space-y-2">
            <button
                onClick={createFromTemplate}
                disabled={submitting}
                className="group inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-3 font-semibold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {submitting ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {creatingLabel}
                    </>
                ) : (
                    <>
                        {labelSignedIn}
                        <ArrowRight className="w-4 h-4 opacity-70 transition-transform group-hover:translate-x-0.5" />
                    </>
                )}
            </button>
            {error && (
                <div
                    role="alert"
                    className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 max-w-md"
                >
                    {error}
                </div>
            )}
        </div>
    );
}
