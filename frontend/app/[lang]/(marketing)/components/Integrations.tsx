'use client';

import { content } from '@/app/[lang]/content/en';
import ScrollReveal from '@/components/ui/ScrollReveal';

interface IntegrationsProps {
    content: typeof content.integrations;
}

export default function Integrations({ content }: IntegrationsProps) {
    return (
        <section className="py-24 border-y border-border/50 bg-muted/20">
            <div className="container px-4 md:px-6">
                <div className="text-center mb-12">
                    <ScrollReveal width="100%">
                        <h2 className="text-3xl font-bold mb-4">{content.title}</h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            {content.subtitle}
                        </p>
                    </ScrollReveal>
                </div>

                <ScrollReveal delay={0.2} width="100%">
                    <div className="flex flex-wrap justify-center gap-8 md:gap-12 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
                        {content.items.map((item) => (
                            <div key={item} className="flex items-center justify-center min-w-[120px] h-16 bg-background/50 rounded-xl border border-border backdrop-blur-sm shadow-sm hover:scale-105 hover:shadow-md transition-all">
                                <span className="font-semibold text-lg text-foreground/80">{item}</span>
                            </div>
                        ))}
                    </div>
                </ScrollReveal>
            </div>
        </section>
    );
}
