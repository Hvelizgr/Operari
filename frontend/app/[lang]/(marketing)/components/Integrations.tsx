'use client';

import { content } from '@/app/[lang]/content/en';
import ScrollReveal from '@/components/ui/ScrollReveal';

interface IntegrationsProps {
    content: typeof content.integrations;
}

export default function Integrations({ content }: IntegrationsProps) {
    return (
        <section className="py-32 bg-background border-y border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-black/50" />
            
            <div className="container px-4 md:px-6 relative z-10 mb-16">
                <div className="text-center max-w-2xl mx-auto">
                    <ScrollReveal width="100%">
                         <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-6">
                            Ecosystem
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white tracking-tight">{content.title}</h2>
                        <p className="text-lg text-gray-400">
                            {content.subtitle}
                        </p>
                    </ScrollReveal>
                </div>
            </div>

            <div className="relative flex flex-col gap-8 opacity-80 hover:opacity-100 transition-opacity duration-500">
                {/* Marquee Row 1 */}
                <div className="flex overflow-hidden relative w-full">
                    <div className="flex gap-8 animate-marquee whitespace-nowrap py-4">
                        {[...content.items, ...content.items, ...content.items].map((item, i) => (
                             <IntegrationCard key={`${item}-${i}`} name={item} />
                        ))}
                    </div>
                </div>

                {/* Marquee Row 2 (Reverse) */}
                <div className="flex overflow-hidden relative w-full">
                     <div className="flex gap-8 animate-marquee-reverse whitespace-nowrap py-4">
                        {[...content.items, ...content.items, ...content.items].reverse().map((item, i) => (
                            <IntegrationCard key={`${item}-${i}-rev`} name={item} />
                        ))}
                    </div>
                </div>
                
                {/* Side Fade Masks */}
                <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            </div>
        </section>
    );
}

function IntegrationCard({ name }: { name: string }) {
    return (
        <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/[0.08] border border-white/10 hover:border-blue-500/40 hover:bg-blue-500/10 transition-all cursor-default">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600/80 to-purple-600/80 flex items-center justify-center font-bold text-xs text-white shadow-lg shadow-blue-500/20">
                {name[0]}
            </div>
            <span className="font-medium text-gray-200 text-sm tracking-wide">{name}</span>
        </div>
    );
}
