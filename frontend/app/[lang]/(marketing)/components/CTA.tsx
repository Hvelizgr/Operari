'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { content } from '../../content/en';
import DemoRequestModal from './DemoRequestModal';
import { GridPattern } from '@/components/ui/GridPattern';

type CTAProps = {
    content: typeof content.cta;
    modalContent: typeof content.modal;
};

export default function CTA({ content, modalContent }: CTAProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <section className="py-32 relative overflow-hidden">
                {/* Background Ambience */}
                <div className="absolute inset-0 bg-background">
                    <GridPattern
                        width={40}
                        height={40}
                        x={-1}
                        y={-1}
                        className="stroke-blue-500/10 [mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
                    />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px]" />

                <div className="container relative z-10 px-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        viewport={{ once: true }}
                        className="max-w-4xl mx-auto bg-card/50 backdrop-blur-lg border border-border/50 rounded-3xl p-12 md:p-20 shadow-2xl shadow-primary/5"
                    >
                        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-8 rotate-3 hover:rotate-6 transition-transform duration-300">
                            <Sparkles className="w-8 h-8 text-primary" />
                        </div>

                        <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-foreground">{content.title}</h2>
                        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">{content.subtitle}</p>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="h-14 px-10 rounded-full bg-foreground text-background font-bold text-lg hover:bg-foreground/90 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto shadow-xl shadow-foreground/20 group"
                        >
                            {content.button}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </motion.div>
                </div>
            </section>

            <DemoRequestModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                content={modalContent}
            />
        </>
    );
}
