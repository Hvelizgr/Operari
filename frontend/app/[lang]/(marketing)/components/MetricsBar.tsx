'use client';

import { useEffect, useRef, useState } from 'react';
import anime from 'animejs';
import { motion } from 'framer-motion';
import { content } from '@/app/[lang]/content/en';

type MetricsBarProps = {
  content: typeof content.metrics;
};

/**
 * Stats band positioned right below the hero. Each number counts up
 * from 0 to its target once the band crosses the viewport. The
 * staggered reveal + number rolling gives the page the same
 * "production-ready, measured" feel that Vercel/Linear landings use
 * without faking vanity metrics.
 *
 * Numbers are pulled from content so they stay honest per locale.
 * `IntersectionObserver` fires once so scrolling back doesn't
 * re-animate — enterprise visitors find that jittery.
 */
export default function MetricsBar({ content }: MetricsBarProps) {
  return (
    <section className="relative py-16 sm:py-20 border-b border-border/40">
      <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
        <div className="text-center mb-10 sm:mb-12">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="m-eyebrow mb-3"
          >
            {content.eyebrow}
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground"
          >
            {content.title}
          </motion.h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl overflow-hidden bg-border/40">
          {content.items.map((item, i) => (
            <MetricCell key={item.label} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCell({
  item,
  index,
}: {
  item: { value: number; suffix: string; label: string; hint: string };
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '-40px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !numberRef.current) return;
    // anime.js over framer's `animate` because we're tweening a
    // plain numeric `p` and writing textContent — framer's value
    // objects would force us to render the whole cell on every
    // frame.
    const obj = { p: 0 };
    const startDelay = 120 + index * 90;
    anime({
      targets: obj,
      p: item.value,
      duration: 1200 + Math.min(item.value * 2, 800),
      delay: startDelay,
      easing: 'easeOutExpo',
      update: () => {
        if (!numberRef.current) return;
        const v = item.value >= 100 ? Math.round(obj.p) : +obj.p.toFixed(0);
        numberRef.current.textContent = String(v);
      },
      complete: () => {
        if (numberRef.current) numberRef.current.textContent = String(item.value);
      },
    });
  }, [visible, item.value, index]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: 0.08 * index, ease: [0.22, 1, 0.36, 1] }}
      className="relative bg-background/70 backdrop-blur-sm p-5 sm:p-7 flex flex-col justify-between gap-3 group hover:bg-background transition-colors"
    >
      <div>
        <div className="flex items-baseline gap-1 text-foreground">
          <span
            ref={numberRef}
            className="font-bold tabular-nums text-3xl sm:text-4xl lg:text-5xl tracking-tight"
          >
            0
          </span>
          {item.suffix && (
            <span className="font-semibold text-lg sm:text-xl text-primary">
              {item.suffix}
            </span>
          )}
        </div>
        <div className="mt-2 text-xs sm:text-sm font-medium text-foreground/80 leading-snug max-w-[22ch]">
          {item.label}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground/80 leading-snug font-mono">
        {item.hint}
      </div>
      {/* thin accent bar that slides in from the left once the cell is
          visible — pure CSS so it doesn't cost an animation frame */}
      <span
        className={`absolute left-0 top-0 bottom-0 w-[2px] bg-primary/50 origin-top transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          visible ? 'scale-y-100' : 'scale-y-0'
        }`}
        style={{ transitionDelay: `${140 + index * 90}ms` }}
      />
    </motion.div>
  );
}
