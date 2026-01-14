'use client';

import { content } from '@/app/[lang]/content/en';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { User } from 'lucide-react';

interface TestimonialsProps {
    content: typeof content.testimonials;
}

export default function Testimonials({ content }: TestimonialsProps) {
    return (
        <section className="py-24 bg-background">
            <div className="container px-4 md:px-6">
                <ScrollReveal width="100%" className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold">{content.title}</h2>
                </ScrollReveal>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {content.items.map((item, index) => (
                        <ScrollReveal key={index} delay={index * 0.15} width="100%">
                            <div className="h-full p-8 rounded-2xl bg-secondary/10 border border-secondary/20 flex flex-col justify-between">
                                <div className="mb-6">
                                    <div className="flex gap-1 mb-4 text-primary">
                                        {[...Array(5)].map((_, i) => (
                                            <span key={i} className="text-lg">★</span>
                                        ))}
                                    </div>
                                    <p className="text-lg italic text-foreground/90 leading-relaxed">
                                        &quot;{item.quote}&quot;
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                        <User className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">{item.author}</p>
                                        <p className="text-sm text-muted-foreground">{item.role}</p>
                                    </div>
                                </div>
                            </div>
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
