'use client';

import { useState }from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Sparkles, Zap, Bot } from 'lucide-react';
import { content } from '@/app/[lang]/content/en';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import DemoRequestModal from './DemoRequestModal';
import { GridPattern } from '@/components/ui/GridPattern';

// Lazy load heavy animation component - loads after hydration
const WorkflowSimulation = dynamic(
  () => import('@/components/ui/WorkflowSimulation'),
  { ssr: false, loading: () => <div className="w-full h-full" /> }
);

type HeroProps = {
  content: typeof content.hero;
  modalContent: typeof content.modal;
};

export default function Hero({ content, modalContent }: HeroProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const params = useParams();
  const lang = params.lang || 'en';

  return (
    <>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-32">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-black z-0">
          {/* Gradient orbs */}
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[150px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
          
          {/* Grid pattern - positioned behind content with lower opacity */}
          <GridPattern
            width={60}
            height={60}
            x={-1}
            y={-1}
            className="absolute inset-0 stroke-white/[0.02] [mask-image:radial-gradient(600px_circle_at_center,white,transparent)] pointer-events-none"
          />
        </div>

        {/* Main Content */}
        <div className="container relative z-10 px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left: Text Content */}
              <div className="text-left">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors cursor-default mb-8 group"
                >
                  <Sparkles className="w-4 h-4 text-yellow-400 group-hover:rotate-12 transition-transform" />
                  <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-bold tracking-wide text-sm">
                    {content.badge}
                  </span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-8 leading-[1.1]"
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/50">{content.title}</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-lg md:text-xl text-gray-400 mb-10 max-w-xl leading-relaxed font-light"
                >
                  {content.subtitle}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="flex flex-col sm:flex-row items-center gap-4"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsModalOpen(true)}
                    className="h-14 px-8 w-full sm:w-auto rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <Zap className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">{content.ctaPrimary}</span>
                    <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                  
                  <Link
                    href={`/${lang}/editor`}
                    className="w-full sm:w-auto"
                    onMouseEnter={() => {
                        if (typeof window !== 'undefined') {
                            void import('@/components/Editor/EditorCanvas');
                        }
                    }}
                  >
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="h-14 px-8 rounded-2xl border-2 border-white/20 bg-black/20 text-white font-semibold text-lg hover:bg-white/10 hover:border-white/40 transition-all flex items-center justify-center gap-3 backdrop-blur-sm"
                    >
                        <Play className="w-5 h-5 text-green-400 fill-green-400/20" />
                        {lang === 'es' ? 'Probar Editor' : 'Try Editor'}
                    </motion.div>
                  </Link>
                </motion.div>

                {/* Trust badges */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="mt-12 flex items-center gap-6 text-sm text-gray-500"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-400" />
                    <span>{lang === 'es' ? 'IA Integrada' : 'AI Powered'}</span>
                  </div>
                  <div className="w-px h-4 bg-gray-700" />
                  <span>{lang === 'es' ? 'Sin código requerido' : 'No code required'}</span>
                  <div className="w-px h-4 bg-gray-700" />
                  <span>{lang === 'es' ? 'Listo en 5 min' : 'Ready in 5min'}</span>
                </motion.div>
              </div>

              {/* Right: Workflow Animation - MORE VISIBLE */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="relative hidden lg:block"
              >
                <div className="relative w-full aspect-[5/4] max-w-[650px] mx-auto">
                  {/* Glow effect behind */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-3xl blur-3xl" />
                  
                  {/* Main container */}
                  <div className="relative w-full h-full rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl overflow-hidden shadow-2xl">
                    {/* Header bar */}
                    <div className="h-10 bg-white/5 border-b border-white/10 flex items-center px-4 gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      <span className="ml-4 text-xs text-gray-500 font-mono">workflow-automation.nf</span>
                    </div>
                    
                    {/* Workflow visualization */}
                    <div className="absolute inset-0 top-10 p-4 flex items-center justify-center">
                      <WorkflowSimulation lang={lang as 'en' | 'es'} />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
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
