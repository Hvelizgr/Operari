'use client';

import { motion } from 'framer-motion';
import { content } from '@/app/[lang]/content/en';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { Check, Code2, Cpu, GitBranch, Lock, Zap, Terminal } from 'lucide-react';

interface FeaturesProps {
  content: typeof content.features;
}

const icons = {
  "🎨": Code2, // Representing Visual Editor as Code
  "💻": Terminal, // TypeScript Native
  "🤖": Cpu, // AI Integration
  "🔒": Lock, // Security
  "📊": Zap, // Performance
  "git": GitBranch, // Version Control
  "🩺": Zap, // Workflow Doctor (fallback)
  "🎓": Code2, // Classroom (fallback)
  "🛡️": Lock, // Firewall (fallback)
  "📜": GitBranch, // Audit Logs (fallback)
  "⏪": GitBranch, // Snapshots (fallback)
  "🔑": Lock // SSO (fallback)
};

export default function Features({ content }: FeaturesProps) {
  return (
    <section id="features" className="py-24 bg-background relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <ScrollReveal width="100%">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white">
              {content.headline}
            </h2>
            <p className="text-xl text-gray-400">
              {content.subheadline}
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.items.map((feature, index) => {
            const Icon = icons[feature.icon as keyof typeof icons] || Zap;
            return (
              <ScrollReveal key={feature.title} delay={index * 0.1} width="100%">
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="h-full p-8 rounded-3xl border border-white/5 bg-[#09090b] hover:bg-white/[0.02] transition-colors relative overflow-hidden group"
                >
                  {/* Hover Gradient Blob */}
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/20 blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center mb-6 shadow-inner group-hover:shadow-blue-500/10 group-hover:border-blue-500/20 transition-all duration-300">
                    <Icon className="w-7 h-7 text-gray-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-3 text-white group-hover:text-blue-200 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed text-sm font-light">
                    {feature.description}
                  </p>
                </motion.div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
