'use client';

import anime from 'animejs';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

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
    <section className="border-border/40 relative border-b py-16 sm:py-20">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center sm:mb-12">
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
            className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl"
          >
            {content.title}
          </motion.h2>
        </div>

        <div className="bg-border/40 grid grid-cols-2 gap-px overflow-hidden rounded-xl lg:grid-cols-4">
          {content.items.map((item, i) => (
            <MetricCell key={item.label} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const ringRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  // Radar ping on hover — a ring scales out from behind the number
  // and fades. Reads as "live metric, not a static screenshot" while
  // staying invisible until intent (no idle motion). Skipped under
  // prefers-reduced-motion.
  const handlePing = () => {
    if (!ringRef.current) return;
    if (prefersReducedMotion()) return;
    anime.remove(ringRef.current);
    anime.set(ringRef.current, { scale: 0.4, opacity: 0.45 });
    anime({
      targets: ringRef.current,
      scale: [0.4, 1.6],
      opacity: [0.45, 0],
      duration: 700,
      easing: 'easeOutCubic',
    });
  };

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '-40px' }
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
      onMouseEnter={handlePing}
      onFocus={handlePing}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: 0.08 * index, ease: [0.22, 1, 0.36, 1] }}
      className="bg-background/70 hover:bg-background group relative flex flex-col justify-between gap-3 p-5 backdrop-blur-sm transition-colors sm:p-7"
    >
      <div>
        <div className="text-foreground relative flex items-baseline gap-1">
          {/* Radar ring — anchored behind the number, invisible until
              hover/focus pings it. pointer-events-none + aria-hidden
              so it never affects layout or assistive tech. */}
          <span
            ref={ringRef}
            aria-hidden="true"
            className="border-primary/40 pointer-events-none absolute -left-2 -top-2 -z-0 h-12 w-12 rounded-full border opacity-0 sm:h-14 sm:w-14"
            style={{ transform: 'scale(0.4)' }}
          />
          <span
            ref={numberRef}
            className="relative z-10 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl lg:text-5xl"
          >
            0
          </span>
          {item.suffix && (
            <span className="text-primary text-lg font-semibold sm:text-xl">{item.suffix}</span>
          )}
        </div>
        <div className="text-foreground/80 mt-2 max-w-[22ch] text-xs font-medium leading-snug sm:text-sm">
          {item.label}
        </div>
      </div>
      <div className="text-muted-foreground/80 font-mono text-[11px] leading-snug">{item.hint}</div>
      {/* thin accent bar that slides in from the left once the cell is
          visible — pure CSS so it doesn't cost an animation frame */}
      <span
        className={`bg-primary/50 absolute bottom-0 left-0 top-0 w-[2px] origin-top transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          visible ? 'scale-y-100' : 'scale-y-0'
        }`}
        style={{ transitionDelay: `${140 + index * 90}ms` }}
      />
    </motion.div>
  );
}
