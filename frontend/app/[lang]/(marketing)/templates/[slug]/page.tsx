import { ArrowLeft, FileCode, Tag } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { specToNodes, yamlToSpec } from '@/utils/runbookYaml';

import { fetchTemplateBySlug, fetchTemplates } from '../fetch-templates';
import { type TemplateLang, templateStrings } from '../strings';
import TemplatePreview from '../TemplatePreview';
import { CopyYamlButton } from './CopyYamlButton';
import { UseTemplateButton } from './UseTemplateButton';

export async function generateStaticParams() {
  const templates = await fetchTemplates();
  const params: Array<{ lang: string; slug: string }> = [];
  for (const lang of ['en', 'es']) {
    for (const tpl of templates) {
      params.push({ lang, slug: tpl.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const template = await fetchTemplateBySlug(slug);
  const typedLang: TemplateLang = lang === 'es' ? 'es' : 'en';
  if (!template) {
    return {
      title: templateStrings[typedLang].detail.notFoundTitle,
    };
  }
  const title = `${template.name} · NanoRun`;
  const description =
    template.description ?? `${template.stepCount} ${templateStrings[typedLang].detail.stepsLabel}`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
  };
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const typedLang: TemplateLang = lang === 'es' ? 'es' : 'en';
  const t = templateStrings[typedLang].detail;
  const template = await fetchTemplateBySlug(slug);
  if (!template) {
    notFound();
  }

  // Parse YAML → node graph server-side so the preview renders
  // from a static SVG without shipping the YAML parser to the
  // browser. A malformed template still shouldn't break the page,
  // so swallow the error and hide the preview section on failure.
  let graph: {
    nodes: ReturnType<typeof specToNodes>['nodes'];
    connections: ReturnType<typeof specToNodes>['connections'];
  } | null = null;
  try {
    const spec = yamlToSpec(template.yaml);
    const parsed = specToNodes(spec);
    graph = { nodes: parsed.nodes, connections: parsed.connections };
  } catch {
    graph = null;
  }

  return (
    <main className="bg-background relative flex-1 pb-24 pt-28 sm:pt-32">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6">
        <Link
          href={`/${typedLang}/templates`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.backToList}
        </Link>

        <div className="mt-8">
          <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <FileCode className="h-3.5 w-3.5" />
            {t.eyebrow}
          </span>
          <h1 className="text-foreground mt-5 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl md:text-5xl">
            {template.name}
          </h1>
          {template.description && (
            <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
              {template.description}
            </p>
          )}

          <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-4 font-mono text-xs">
            {template.category && (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3 w-3" />
                {template.category}
              </span>
            )}
            <span>
              {template.stepCount} {t.stepsLabel}
            </span>
            <span className="max-w-sm truncate">{template.file}</span>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <UseTemplateButton
              slug={template.slug}
              lang={typedLang}
              labelSignedIn={t.useCta}
              labelSignedOut={t.useCtaSignup}
              creatingLabel={t.creatingCta}
              errorLabel={t.createError}
            />
            <CopyYamlButton yaml={template.yaml} copyLabel={t.copyCta} copiedLabel={t.copiedCta} />
          </div>
        </div>

        {graph && graph.nodes.length > 0 && (
          <section className="mt-12">
            <div className="border-border/60 bg-card/40 overflow-hidden rounded-xl border">
              <div className="border-border/40 bg-background/40 flex items-center gap-1.5 border-b px-4 py-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
                <div className="bg-primary/60 h-2.5 w-2.5 rounded-full" />
                <span className="text-muted-foreground ml-3 font-mono text-[11px]">
                  {t.graphHeader}
                </span>
              </div>
              <div className="p-5">
                <TemplatePreview nodes={graph.nodes} connections={graph.connections} />
                <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
                  {t.graphHint}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="border-border/60 bg-card/40 overflow-hidden rounded-xl border">
            <div className="border-border/40 bg-background/40 flex items-center gap-1.5 border-b px-4 py-2.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
              <div className="bg-primary/60 h-2.5 w-2.5 rounded-full" />
              <span className="text-muted-foreground ml-3 font-mono text-[11px]">
                {t.yamlHeader}
              </span>
            </div>
            <pre className="text-foreground/90 overflow-x-auto p-5 font-mono text-[12px] leading-relaxed">
              <code>{template.yaml}</code>
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
