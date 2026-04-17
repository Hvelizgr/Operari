import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileCode, Tag } from 'lucide-react';
import { fetchTemplateBySlug, fetchTemplates } from '../fetch-templates';
import { templateStrings, type TemplateLang } from '../strings';
import { UseTemplateButton } from './UseTemplateButton';
import { CopyYamlButton } from './CopyYamlButton';
import TemplatePreview from '../TemplatePreview';
import { yamlToSpec, specToNodes } from '@/utils/runbookYaml';

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
    const title = `${template.name} · Cairn`;
    const description =
        template.description ??
        `${template.stepCount} ${templateStrings[typedLang].detail.stepsLabel}`;
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
    let graph: { nodes: ReturnType<typeof specToNodes>['nodes']; connections: ReturnType<typeof specToNodes>['connections'] } | null = null;
    try {
        const spec = yamlToSpec(template.yaml);
        const parsed = specToNodes(spec);
        graph = { nodes: parsed.nodes, connections: parsed.connections };
    } catch {
        graph = null;
    }

    return (
        <main className="relative flex-1 bg-background pt-28 pb-24 sm:pt-32">
            <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                <Link
                    href={`/${typedLang}/templates`}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t.backToList}
                </Link>

                <div className="mt-8">
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        <FileCode className="w-3.5 h-3.5" />
                        {t.eyebrow}
                    </span>
                    <h1 className="mt-5 text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.02em] leading-[1.1] text-foreground">
                        {template.name}
                    </h1>
                    {template.description && (
                        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                            {template.description}
                        </p>
                    )}

                    <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground">
                        {template.category && (
                            <span className="inline-flex items-center gap-1.5">
                                <Tag className="w-3 h-3" />
                                {template.category}
                            </span>
                        )}
                        <span>
                            {template.stepCount} {t.stepsLabel}
                        </span>
                        <span className="truncate max-w-sm">{template.file}</span>
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
                        <CopyYamlButton
                            yaml={template.yaml}
                            copyLabel={t.copyCta}
                            copiedLabel={t.copiedCta}
                        />
                    </div>
                </div>

                {graph && graph.nodes.length > 0 && (
                    <section className="mt-12">
                        <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
                            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/40 bg-background/40">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                                <div className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
                                <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                                <span className="ml-3 font-mono text-[11px] text-muted-foreground">
                                    {t.graphHeader}
                                </span>
                            </div>
                            <div className="p-5">
                                <TemplatePreview
                                    nodes={graph.nodes}
                                    connections={graph.connections}
                                />
                                <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
                                    {t.graphHint}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                <section className="mt-12">
                    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
                        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/40 bg-background/40">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
                            <div className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
                            <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                            <span className="ml-3 font-mono text-[11px] text-muted-foreground">
                                {t.yamlHeader}
                            </span>
                        </div>
                        <pre className="p-5 overflow-x-auto font-mono text-[12px] leading-relaxed text-foreground/90">
                            <code>{template.yaml}</code>
                        </pre>
                    </div>
                </section>
            </div>
        </main>
    );
}
