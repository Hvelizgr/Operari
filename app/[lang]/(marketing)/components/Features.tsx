'use client';

import { motion } from 'framer-motion';
import { content } from '@/app/[lang]/content/en';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { Check, Code2, Cpu, GitBranch, Lock, Zap } from 'lucide-react';

interface FeaturesProps {
  content: typeof content.features;
}

const icons = {
  "🎨": Zap,
  "💻": Code2,
  "🤖": Cpu,
  "🔒": Lock,
  "📊": Check, // Placeholder
  "git": GitBranch
};

export default function Features({ content }: FeaturesProps) {
  return (
    <section id="features" className="py-24 bg-background relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px]" />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <ScrollReveal width="100%">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              {content.headline}
            </h2>
            <p className="text-xl text-muted-foreground">
              {content.subheadline}
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.items.map((feature, index) => {
            const Icon = icons[feature.icon as keyof typeof icons] || Zap;
            return (
              <ScrollReveal key={feature.title} delay={index * 0.1} width="100%">
                <div className="p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all duration-300 backdrop-blur-sm group hover:-translate-y-1 hover:shadow-lg">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
