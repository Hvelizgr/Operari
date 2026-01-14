'use client';

import { motion } from 'framer-motion';
import { Server, RefreshCw, Bot } from 'lucide-react';
import { content } from '@/app/[lang]/content/en';

const icons = [Server, RefreshCw, Bot];

type UseCasesProps = {
  content: typeof content.useCases;
};

export default function UseCases({ content }: UseCasesProps) {
  return (
    <section className="py-32 bg-background relative">
      <div className="container px-4">
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-20 tracking-tight">{content.title}</h2>

        <div className="grid md:grid-cols-3 gap-8">
          {content.items.map((item, index) => {
            const Icon = icons[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
                viewport={{ once: true, margin: "-50px" }}
                className="group p-8 rounded-2xl bg-card border border-border/50 hover:border-border/80 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden"
              >
                {/* Subtle gradient background on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 ease-out">
                  <Icon className="w-7 h-7 text-primary group-hover:text-inherit transition-colors" />
                </div>

                <h3 className="text-xl font-bold mb-4 group-hover:text-primary transition-colors">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-base group-hover:text-foreground/80 transition-colors">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
