'use client';

import { motion } from 'framer-motion';
import { content } from '@/app/[lang]/content/en';

type HowItWorksProps = {
  content: typeof content.howItWorks;
};

export default function HowItWorks({ content }: HowItWorksProps) {
  return (
    <section className="py-32 bg-black relative border-y border-white/5 overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 opacity-20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </div>
      
      <div className="container px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-white">{content.title}</h2>
        </div>

        <div className="relative">
          {/* Enhanced Connector Line */}
          <div className="hidden md:block absolute top-[3rem] left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0"></div>

          <div className="grid md:grid-cols-3 gap-16 relative">
            {content.steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2, duration: 0.5 }}
                viewport={{ once: true }}
                className="relative flex flex-col items-center text-center group"
              >
                <div className="w-24 h-24 mb-8 rounded-full bg-zinc-900 border border-white/10 shadow-2xl flex items-center justify-center text-3xl font-bold text-white relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                  <span className="bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-500 group-hover:from-blue-400 group-hover:to-purple-400">
                    {index + 1}
                  </span>
                </div>

                <h3 className="text-xl font-bold mb-3 tracking-tight text-white group-hover:text-blue-400 transition-colors">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed max-w-xs">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
