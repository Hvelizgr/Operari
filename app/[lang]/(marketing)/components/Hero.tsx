'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Terminal, Play } from 'lucide-react';
import { content } from '@/app/[lang]/content/en';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DemoRequestModal from './DemoRequestModal';

type HeroProps = {
  content: typeof content.hero;
  modalContent: typeof content.modal;
};

// Note: Updated props to accept modalContent
export default function Hero({ content, modalContent }: HeroProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const params = useParams();
  const lang = params.lang || 'en';

  return (
    <>
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-32 pb-20">
        {/* Refined Background Gradients */}
        <div className="absolute inset-0 bg-background z-0">
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-primary/5 rounded-full blur-[120px] opacity-60 mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] opacity-40 mix-blend-screen" />
          <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] opacity-30 mix-blend-screen" />
        </div>

        <div className="container relative z-10 px-4 md:px-6">
          <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-secondary/50 border border-secondary text-secondary-foreground/90 text-sm font-medium mb-8 backdrop-blur-sm cursor-default hover:bg-secondary/70 transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              {content.badge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground via-foreground to-foreground/60 mb-8 leading-[1.1] whitespace-pre-line"
            >
              {content.title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-lg md:text-xl text-muted-foreground/80 mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              {content.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
            >
              <button
                onClick={() => setIsModalOpen(true)}
                className="h-14 px-8 rounded-full bg-foreground text-background font-semibold hover:bg-foreground/90 transition-all active:scale-95 flex items-center gap-2 group w-full sm:w-auto justify-center shadow-xl shadow-foreground/10"
              >
                {content.ctaPrimary}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <Link
                href={`/${lang}/editor`}
                className="h-14 px-8 rounded-full border border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500 text-orange-400 font-semibold transition-all active:scale-95 flex items-center gap-2 w-full sm:w-auto justify-center backdrop-blur-sm group"
              >
                <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />
                {lang === 'es' ? 'Probar Editor' : 'Try Editor'}
              </Link>
            </motion.div>
          </div>
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
