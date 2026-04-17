import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FileCode, Tag } from 'lucide-react';
import { fetchTemplates } from './fetch-templates';
import { templateStrings, type TemplateLang } from './strings';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: string }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const typedLang: TemplateLang = lang === 'es' ? 'es' : 'en';
    const t = templateStrings[typedLang].list;
    return {
        title: `${t.title} · Cairn`,
        description: t.subtitle,
        openGraph: {
            title: t.title,
            description: t.subtitle,
        },
    };
}

function groupByCategory(templates: Awaited<ReturnType<typeof fetchTemplates>>) {
    const categories = new Map<string, typeof templates>();
    for (const tpl of templates) {
        const key = tpl.category ?? 'other';
        const bucket = categories.get(key);
        if (bucket) bucket.push(tpl);
        else categories.set(key, [tpl]);
    }
    return [...categories.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default async function TemplatesPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const typedLang: TemplateLang = lang === 'es' ? 'es' : 'en';
    const t = templateStrings[typedLang].list;
    const templates = await fetchTemplates();
    const grouped = groupByCategory(templates);

    return (
        <main className="relative flex-1 bg-background pt-28 pb-24 sm:pt-32">
            <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                <div className="max-w-3xl">
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        <FileCode className="w-3.5 h-3.5" />
                        {t.eyebrow}
                    </span>
                    <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.03em] leading-[1.05] text-foreground">
                        {t.title}
                    </h1>
                    <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
                        {t.subtitle}
                    </p>
                </div>

                {templates.length === 0 ? (
                    <div className="mt-16 rounded-xl border border-dashed border-border/60 bg-card/20 p-12 text-center text-muted-foreground">
                        {t.empty}
                    </div>
                ) : (
                    <div className="mt-16 space-y-12">
                        {grouped.map(([category, items]) => (
                            <section key={category}>
                                <h2 className="mb-5 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                                    <Tag className="w-3 h-3" />
                                    {category}
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {items.map((tpl) => (
                                        <Link
                                            key={tpl.slug}
                                            href={`/${typedLang}/templates/${tpl.slug}`}
                                            className="group block rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 hover:border-primary/40 p-5 transition-all"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <FileCode className="w-4 h-4 text-primary/70" />
                                                <span className="text-xs font-mono text-muted-foreground">
                                                    {tpl.stepCount} {t.stepsLabel}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-semibold text-foreground mb-2 leading-tight">
                                                {tpl.name}
                                            </h3>
                                            {tpl.description && (
                                                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4">
                                                    {tpl.description}
                                                </p>
                                            )}
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary group-hover:gap-2 transition-all">
                                                {t.viewCta}
                                                <ArrowRight className="w-3 h-3" />
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}

                <div className="mt-20">
                    <Link
                        href={`/${typedLang}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← {t.backToHome}
                    </Link>
                </div>
            </div>
        </main>
    );
}
