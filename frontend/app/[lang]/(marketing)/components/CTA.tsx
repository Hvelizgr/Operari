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
                <div className="absolute inset-0 bg-black">
                    <GridPattern
                        width={40}
                        height={40}
                        x={-1}
                        y={-1}
                        className="stroke-gray-500/5 [mask-image:radial-gradient(800px_circle_at_center,white,transparent)]"
                    />
                </div>
                
                {/* Magnetic Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/30 to-purple-600/30 rounded-full blur-[100px] animate-pulse" />

                <div className="container relative z-10 px-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        viewport={{ once: true }}
                        className="max-w-5xl mx-auto bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-16 md:p-24 relative overflow-hidden group shadow-2xl shadow-blue-900/20"
                    >
                         {/* Card Inner Glow */}
                         <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                         
                         <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-10 shadow-lg shadow-blue-500/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                <Sparkles className="w-10 h-10 text-white" />
                            </div>

                            <h2 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight text-white leading-tight">
                                {content.title}
                            </h2>
                            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
                                {content.subtitle}
                            </p>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsModalOpen(true)}
                                className="h-16 px-12 rounded-full bg-white text-black font-bold text-xl hover:bg-gray-100 transition-all flex items-center gap-3 mx-auto shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)]"
                            >
                                <span className="bg-gradient-to-r from-black to-gray-700 bg-clip-text text-transparent">
                                    {content.button}
                                </span>
                                <ArrowRight className="w-6 h-6 text-black" />
                            </motion.button>
                         </div>
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
