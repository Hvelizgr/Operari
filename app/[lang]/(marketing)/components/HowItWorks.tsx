'use client';

import { motion } from 'framer-motion';
import { content } from '@/app/[lang]/content/en';

type HowItWorksProps = {
  content: typeof content.howItWorks;
};

export default function HowItWorks({ content }: HowItWorksProps) {
  return (
    <section className="py-32 bg-secondary/20 border-y border-border/50">
      <div className="container px-4">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">{content.title}</h2>
        </div>

        <div className="relative">
          {/* Enhanced Connector Line */}
          <div className="hidden md:block absolute top-[2.5rem] left-[16%] right-[16%] h-px bg-border">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent w-full h-full" />
          </div>

          <div className="grid md:grid-cols-3 gap-16 relative">
            {content.steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2, duration: 0.5 }}
                viewport={{ once: true }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 mb-8 rounded-2xl bg-background border-2 border-border shadow-lg flex items-center justify-center text-2xl font-bold text-foreground relative z-10 group transition-all duration-300 hover:border-primary hover:shadow-primary/20 hover:-translate-y-1">
                  <span className="bg-clip-text text-transparent bg-gradient-to-br from-foreground to-muted-foreground group-hover:from-primary group-hover:to-primary">
                    {index + 1}
                  </span>
                </div>

                <h3 className="text-xl font-bold mb-3 tracking-tight">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed max-w-xs">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
