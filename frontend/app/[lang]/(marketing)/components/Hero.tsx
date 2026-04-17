'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Copy, Check, Terminal, Github } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import anime from 'animejs';
import { content } from '@/app/[lang]/content/en';
import { repo } from '@/config/repo.config';
import AuroraBackground from './AuroraBackground';

type HeroProps = {
  content: typeof content.hero;
};

/**
 * Hero — API-first positioning.
 *
 * Left column: badge + headline + subtitle + dual CTA (primary "Get API key",
 * secondary "or self-host"). The old docker-compose-up command still lives
 * one section down in the CTA block for users who want to self-host; the
 * hero is deliberately Stripe/Resend-shaped so it reads as a hosted service
 * first and an open-source backbone second.
 *
 * Right column: a terminal-style "Request → Response → Stream" panel that
 * shows what a single `runs/trigger` call looks like end-to-end. anime.js
 * drives three staged animations:
 *
 *   1. The curl request lines type themselves character-by-character so the
 *      reader sees the API shape being assembled (not just a static code
 *      block). ~2s to finish.
 *   2. The response panel slides up + fades in after the request completes
 *      (status code "201 Created" + JSON body), mimicking a real API
 *      reply arriving.
 *   3. Each stream step pops in with a stagger, ending with a "run
 *      completed · audit chain verified" footer so the story closes on the
 *      evidence/audit beat that is our actual moat vs Stripe Workflows etc.
 *
 * The sequence loops every ~12s so visitors who linger see it again.
 */
export default function Hero({ content }: HeroProps) {
  const params = useParams();
  const lang = (params.lang as string) || 'en';
  const [copied, setCopied] = useState(false);

  const copyEndpoint = () => {
    void navigator.clipboard
      .writeText('curl -X POST https://api.cairn.run/v1/runs/trigger')
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
  };

  return (
    <section className="relative flex items-center overflow-hidden pt-28 sm:pt-32 pb-16 sm:pb-20 min-h-[88vh] lg:min-h-[100vh]">
      <AuroraBackground
        grid
        orbs={[
          { color: 'emerald', size: 900, x: '10%', y: '-25%', opacity: 0.1, duration: 14, drift: 40 },
          { color: 'primary', size: 750, x: '60%', y: '60%', opacity: 0.08, duration: 16, delay: 2, drift: 45 },
          { color: 'emerald', size: 500, x: '40%', y: '20%', opacity: 0.05, duration: 11, delay: 4, drift: 25 },
        ]}
      />

      <div className="container relative z-10 px-4 sm:px-6 mx-auto w-full">
        <div className="grid lg:grid-cols-[1.05fr,1.1fr] gap-10 sm:gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          {/* LEFT — copy + CTAs */}
          <div className="flex flex-col items-start text-left min-w-0">
            <motion.a
              href={repo.status}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="inline-flex items-center gap-2.5 px-3 sm:px-4 py-1.5 rounded-full bg-secondary/50 border border-secondary text-secondary-foreground/90 text-xs sm:text-sm font-medium mb-6 sm:mb-8 backdrop-blur-sm hover:bg-secondary/70 transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              {content.badge}
            </motion.a>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-[-0.03em] mb-5 sm:mb-6 leading-[1.05] whitespace-pre-line text-foreground"
            >
              {content.title.split('\n').map((line, i) => (
                <span key={i}>
                  {i === 1 ? (
                    <span className="bg-gradient-to-r from-primary via-emerald-300 to-primary bg-clip-text text-transparent">{line}</span>
                  ) : (
                    line
                  )}
                  {i === 0 && '\n'}
                </span>
              ))}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-xl leading-relaxed"
            >
              {content.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto"
            >
              {/* Primary CTA: "Get API key". Goes to /signup which the hosted
                  onboarding will claim — today it falls back to the docs anchor
                  so the button is never a dead link. */}
              <Link
                href={`/${lang}/signup`}
                className="group h-14 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm md:text-base flex items-center gap-3 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:bg-primary/90 active:scale-[0.98] transition-all w-full sm:w-auto justify-center"
              >
                {content.ctaPrimary}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>

              {/* Secondary: self-host via the GitHub repo. Still accessible
                  but no longer the visual anchor. */}
              <Link
                href={repo.base}
                target="_blank"
                rel="noopener noreferrer"
                className="h-14 px-5 sm:px-6 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-secondary text-foreground font-medium transition-all flex items-center justify-center gap-2 group"
              >
                <Github className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                {content.ctaSecondary}
              </Link>
            </motion.div>

            {/* Quick endpoint chip — click-to-copy the base curl so a reader
                curious enough to try the API doesn't have to hunt for it
                in the docs. */}
            <motion.button
              onClick={copyEndpoint}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-1.5 font-mono text-[11px] sm:text-xs text-foreground/70 hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-primary" />
              <span className="truncate">
                POST <span className="text-primary">api.cairn.run</span>/v1/runs/trigger
              </span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 opacity-60" />}
            </motion.button>
          </div>

          {/* RIGHT — animated API request/response/stream terminal */}
          <ApiTerminal content={content.scenario} />
        </div>
      </div>
    </section>
  );
}

/**
 * Three-pane terminal: request (typed), response (reveals), stream (staggers).
 *
 * Uses anime.js for all three animations instead of framer-motion. Reason:
 * (a) the typing effect needs per-character control on a string whose length
 * changes per locale, which is awkward in framer; (b) anime.js timelines
 * chain cleanly (request.finished → response.begin → stream.begin) without
 * prop-driven orchestration; (c) we wanted to show off anime.js *somewhere*
 * on the page, and this is the highest-visibility slot.
 */
function ApiTerminal({ content: s }: { content: typeof content.hero.scenario }) {
  const requestRef = useRef<HTMLPreElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<anime.AnimeTimelineInstance | null>(null);

  useEffect(() => {
    // Bail if any ref isn't mounted yet (SSR / strict-mode remount).
    if (!requestRef.current || !responseRef.current || !streamRef.current) return;

    const requestLines = Array.from(
      requestRef.current.querySelectorAll<HTMLSpanElement>('[data-req-line]'),
    );
    const streamLines = Array.from(
      streamRef.current.querySelectorAll<HTMLDivElement>('[data-stream-line]'),
    );

    // Snap everything back to its "start" position whenever the effect
    // re-runs so the loop replays deterministically (no double reveal).
    requestLines.forEach((line) => {
      const full = line.dataset.full ?? '';
      line.textContent = '';
      line.dataset.full = full;
    });
    if (responseRef.current) {
      responseRef.current.style.opacity = '0';
      responseRef.current.style.transform = 'translateY(8px)';
    }
    streamLines.forEach((line) => {
      line.style.opacity = '0';
      line.style.transform = 'translateX(-6px)';
    });
    if (footerRef.current) footerRef.current.style.opacity = '0';

    const tl = anime.timeline({
      easing: 'easeOutQuart',
      loop: true,
      loopDelay: 4500,
    });

    // 1. Type each request line character-by-character. anime.js doesn't
    //    ship a typing primitive — we drive a numeric `progress` from 0→1
    //    per line and slice the stored `data-full` text accordingly.
    requestLines.forEach((line, i) => {
      const full = line.dataset.full ?? '';
      tl.add({
        targets: { p: 0 },
        p: 1,
        duration: Math.max(260, full.length * 18),
        easing: 'linear',
        delay: i === 0 ? 350 : 80,
        update: (anim) => {
          const p = anim.animations[0].currentValue as unknown as number;
          const cut = Math.floor(Number(p) * full.length);
          line.textContent = full.slice(0, cut);
        },
        complete: () => {
          line.textContent = full;
        },
      });
    });

    // 2. Response panel slides in once the request is "sent".
    tl.add(
      {
        targets: responseRef.current,
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 520,
      },
      '+=250',
    );

    // 3. Stream lines pop in one by one. Stagger is anime.js-native so
    //    the compiler can optimize the per-line delay math.
    tl.add(
      {
        targets: streamLines,
        opacity: [0, 1],
        translateX: [-6, 0],
        duration: 420,
        delay: anime.stagger(320),
      },
      '+=180',
    );

    // 4. Footer ("run completed · audit chain verified") fades in last
    //    so the eye lands on the moat beat.
    tl.add(
      {
        targets: footerRef.current,
        opacity: [0, 1],
        translateY: [6, 0],
        duration: 480,
      },
      '+=200',
    );

    timelineRef.current = tl;

    return () => {
      tl.pause();
      timelineRef.current = null;
    };
  }, [s]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-xl mx-auto lg:mx-0 lg:ml-auto"
      aria-hidden="true"
    >
      {/* Ambient emerald halo around the whole card */}
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-b from-primary/[0.08] via-transparent to-primary/[0.04] blur-2xl" />

      <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-2xl shadow-black/40 overflow-hidden">
        {/* Title bar — traffic lights + endpoint badge. The method pill
            uses the same accent as the primary CTA so the eye links them
            visually (press button → this endpoint runs). */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border/70 bg-card/60">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end sm:justify-start">
            <span className="shrink-0 rounded-md bg-primary/15 border border-primary/30 px-1.5 py-0.5 font-mono text-[10px] sm:text-[11px] font-semibold text-primary">
              {s.requestMethod}
            </span>
            <span className="truncate font-mono text-[11px] sm:text-xs text-foreground/70">
              {s.requestUrl}
            </span>
          </div>
        </div>

        {/* Request pane */}
        <div className="px-4 sm:px-5 py-4 border-b border-border/70">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
            {s.requestLabel}
          </div>
          <pre
            ref={requestRef}
            className="font-mono text-[11px] sm:text-xs text-foreground/90 leading-relaxed whitespace-pre overflow-x-auto"
          >
            {s.requestLines.map((line, i) => (
              <span key={i} data-req-line data-full={line} className="block">
                {''}
              </span>
            ))}
          </pre>
        </div>

        {/* Response pane — hidden until the timeline reveals it */}
        <div
          ref={responseRef}
          className="px-4 sm:px-5 py-4 border-b border-border/70"
          style={{ opacity: 0, transform: 'translateY(8px)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {s.responseLabel}
            </span>
            <span className="font-mono text-[10px] text-emerald-400">
              {s.responseStatus}
            </span>
          </div>
          <pre className="font-mono text-[11px] sm:text-xs text-foreground/90 leading-relaxed whitespace-pre overflow-x-auto">
            {s.responseBody.join('\n')}
          </pre>
        </div>

        {/* Stream pane — each line pops in with an emerald arrow */}
        <div ref={streamRef} className="px-4 sm:px-5 py-4">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
            {s.streamLabel}
          </div>
          <div className="space-y-1.5">
            {s.streamSteps.map((line, i) => (
              <div
                key={i}
                data-stream-line
                className="font-mono text-[11px] sm:text-xs text-emerald-300/90"
                style={{ opacity: 0, transform: 'translateX(-6px)' }}
              >
                {line}
              </div>
            ))}
          </div>
          <div
            ref={footerRef}
            className="mt-3 pt-3 border-t border-border/60 font-mono text-[10px] sm:text-[11px] text-muted-foreground"
            style={{ opacity: 0 }}
          >
            {s.streamFooter}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
