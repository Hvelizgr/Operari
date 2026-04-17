'use client';

import { motion } from 'framer-motion';
import { Shield, GitBranch, Zap, Puzzle } from 'lucide-react';

type SafetyContent = {
    eyebrow: string;
    title: string;
    subtitle: string;
    rails: Array<{ title: string; description: string; example?: string }>;
};

const ICONS = [Shield, GitBranch, Zap, Puzzle];

/**
 * Safety Rails — the "why NOT another n8n" section.
 *
 * These four features are the actual differentiation vs generic
 * workflow engines (n8n, Zapier clones) once a buyer gets past the
 * "visual canvas" surface: dry-run, error-workflow meta-automation,
 * sub-workflow composition, and a first-class SDK for custom steps.
 * Each is a line on the comparison table, but the table is dense —
 * this section slows the reader down and makes the case for each.
 */
export default function SafetyRails({ content }: { content: SafetyContent }) {
    return (
        <section className="relative py-24 sm:py-32 bg-background">
            <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
                <div className="max-w-2xl mb-14 sm:mb-20">
                    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-5">
                        <Shield className="w-3.5 h-3.5" />
                        {content.eyebrow}
                    </span>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
                        {content.title}
                    </h2>
                    <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                        {content.subtitle}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {content.rails.map((rail, i) => {
                        const Icon = ICONS[i % ICONS.length];
                        return (
                            <motion.div
                                key={rail.title}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ duration: 0.4, delay: i * 0.05 }}
                                className="rounded-2xl border border-border/60 bg-card/40 hover:bg-card/60 hover:border-primary/30 p-6 transition-all"
                            >
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground leading-snug">
                                        {rail.title}
                                    </h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    {rail.description}
                                </p>
                                {rail.example && (
                                    <pre className="rounded-lg border border-border/60 bg-background/40 p-3 font-mono text-[11px] leading-relaxed text-foreground/80 overflow-x-auto">
                                        <code>{rail.example}</code>
                                    </pre>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
