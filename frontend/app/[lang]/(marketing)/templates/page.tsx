import { FileCode } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { fetchTemplates } from './fetch-templates';
import { type TemplateLang, templateStrings } from './strings';
import TemplatesRegistry from './TemplatesRegistry';

// The backend is not available at docker image build time, so a static
// pre-render captures an empty list and shows "no templates available
// yet" until ISR fires. Render at request time instead — the fetch
// itself still has its own 1h revalidate, so we don't hit the backend
// on every hit, but the first request after deploy is always live.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const typedLang: TemplateLang = lang === 'es' ? 'es' : 'en';
  const t = templateStrings[typedLang].list;
  return {
    title: `${t.title} · Operari`,
    description: t.subtitle,
    openGraph: {
      title: t.title,
      description: t.subtitle,
    },
  };
}

export default async function TemplatesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang: TemplateLang = lang === 'es' ? 'es' : 'en';
  const t = templateStrings[typedLang].list;
  const templates = await fetchTemplates();

  return (
    <main className="bg-background relative flex-1 pb-24 pt-28 sm:pt-32">
      {/* Catalog band — diagonal neon stripe top-left for the registry feel */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div
          className="absolute -left-1/4 -top-32 h-72 w-[140%] rotate-[-3deg] opacity-[0.12]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(62,207,142,0.4), transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      <div className="container relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Compact header — the H1 is smaller; the catalog UI below is the
                    real visual anchor. */}
        <div className="border-border/40 mb-10 flex flex-col gap-6 border-b pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider">
              <FileCode className="h-3 w-3" />
              {t.eyebrow}
            </span>
            <h1 className="text-foreground mt-4 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl md:text-5xl">
              {t.title}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
              {t.subtitle}
            </p>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="border-border/60 bg-card/20 text-muted-foreground rounded-xl border border-dashed p-12 text-center">
            {t.empty}
          </div>
        ) : (
          <TemplatesRegistry
            templates={templates}
            lang={typedLang}
            strings={{
              searchPlaceholder: t.searchPlaceholder,
              countLabel: t.countLabel,
              noResults: t.noResults,
              stepsLabel: t.stepsLabel,
              previewLabel: t.previewLabel,
              viewCta: t.viewCta,
              categoryAll: t.categoryAll,
            }}
          />
        )}

        <div className="mt-20">
          <Link
            href={`/${typedLang}`}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ← {t.backToHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
