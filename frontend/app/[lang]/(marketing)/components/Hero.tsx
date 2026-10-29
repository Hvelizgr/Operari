'use client';

import anime from 'animejs';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Check, Copy, Github, RotateCcw, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  // Gentle scroll-linked parallax on the right-column terminal. The
  // range is [section entering viewport → fully scrolled past], and
  // we translate Y by a small amount so the terminal appears to
  // lag the text column by ~8-12% — enterprise, not carnival. The
  // `reduceMotion` hook zeros this out for users who opted out.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const terminalY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, -60]);
  const terminalOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.6]);

  const copyEndpoint = () => {
    void navigator.clipboard
      .writeText('curl -X POST https://api.operari.dev/v1/runs/trigger')
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
  };

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[88vh] items-center overflow-hidden pb-16 pt-28 sm:pb-20 sm:pt-32 lg:min-h-[100vh]"
    >
      <AuroraBackground
        grid
        orbs={[
          {
            color: 'emerald',
            size: 900,
            x: '10%',
            y: '-25%',
            opacity: 0.1,
            duration: 14,
            drift: 40,
          },
          {
            color: 'primary',
            size: 750,
            x: '60%',
            y: '60%',
            opacity: 0.08,
            duration: 16,
            delay: 2,
            drift: 45,
          },
          {
            color: 'emerald',
            size: 500,
            x: '40%',
            y: '20%',
            opacity: 0.05,
            duration: 11,
            delay: 4,
            drift: 25,
          },
        ]}
      />

      <div className="container relative z-10 mx-auto w-full px-4 sm:px-6">
        <div className="mx-auto grid max-w-7xl items-center gap-10 sm:gap-12 lg:grid-cols-[1.05fr,1.1fr] lg:gap-16">
          {/* LEFT — copy + CTAs */}
          <div className="flex min-w-0 flex-col items-start text-left">
            <motion.a
              href={repo.status}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="bg-secondary/50 border-secondary text-secondary-foreground/90 hover:bg-secondary/70 mb-6 inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-colors sm:mb-8 sm:px-4 sm:text-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
              </span>
              {content.badge}
            </motion.a>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-foreground mb-5 whitespace-pre-line text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:mb-6 sm:text-5xl md:text-6xl lg:text-7xl"
            >
              {content.title.split('\n').map((line, i) => (
                <span key={i}>
                  {i === 1 ? (
                    <span className="from-primary to-primary bg-gradient-to-r via-emerald-300 bg-clip-text text-transparent">
                      {line}
                    </span>
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
              className="text-muted-foreground mb-8 max-w-xl text-base leading-relaxed sm:mb-10 sm:text-lg md:text-xl"
            >
              {content.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center"
            >
              {/* Primary CTA: register for the self-serve workspace.
                  Auth + billing are live (docs/DEPLOYMENT.md) so this
                  button goes straight into the signup flow — no
                  waitlist, no mailto. `/signup` (the original
                  "get-api-key" waitlist) still exists but is linked
                  from the footer for hosted-API early-access. */}
              <Link
                href={`/${lang}/register`}
                className="shimmer-hover bg-primary text-primary-foreground shadow-primary/20 hover:shadow-primary/30 hover:bg-primary/90 group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-xl px-6 text-sm font-semibold shadow-xl transition-all hover:shadow-2xl active:scale-[0.98] sm:w-auto md:text-base"
              >
                <span className="relative z-[1]">{content.ctaPrimary}</span>
                <ArrowRight className="relative z-[1] h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>

              {/* Secondary: self-host via the GitHub repo. Still accessible
                  but no longer the visual anchor. */}
              <Link
                href={repo.base}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-secondary/30 hover:bg-secondary/50 hover:border-secondary text-foreground group flex h-14 items-center justify-center gap-2 rounded-xl border px-5 font-medium transition-all sm:px-6"
              >
                <Github className="h-4 w-4 opacity-70 transition-opacity group-hover:opacity-100" />
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
              className="border-border/60 bg-card/40 text-foreground/70 hover:text-foreground hover:border-primary/40 mt-6 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-colors sm:text-xs"
            >
              <Terminal className="text-primary h-3.5 w-3.5" />
              <span className="truncate">
                POST <span className="text-primary">api.operari.dev</span>/v1/runs/trigger
              </span>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 opacity-60" />
              )}
            </motion.button>
          </div>

          {/* RIGHT — animated API request/response/stream terminal.
              Wrapped in a motion shell so the terminal drifts a touch
              slower than the left column as the page scrolls. The
              drift is tiny (<60px over the hero height) so visitors
              read it as parallax depth, not movement. */}
          <motion.div style={{ y: terminalY, opacity: terminalOpacity }}>
            <ApiTerminal content={content.scenario} lang={lang} />
          </motion.div>
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
function ApiTerminal({
  content: s,
  lang,
}: {
  content: typeof content.hero.scenario;
  lang: string;
}) {
  const requestRef = useRef<HTMLPreElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<anime.AnimeTimelineInstance | null>(null);
  const replayRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Bail if any ref isn't mounted yet (SSR / strict-mode remount).
    if (!requestRef.current || !responseRef.current || !streamRef.current) return;

    const requestLines = Array.from(
      requestRef.current.querySelectorAll<HTMLSpanElement>('[data-req-line]')
    );
    const streamLines = Array.from(
      streamRef.current.querySelectorAll<HTMLDivElement>('[data-stream-line]')
    );

    // Snap everything back to its "start" position whenever the effect
    // re-runs so the loop replays deterministically (no double reveal).
    requestLines.forEach(line => {
      const full = line.dataset.full ?? '';
      line.textContent = '';
      line.dataset.full = full;
    });
    if (responseRef.current) {
      responseRef.current.style.opacity = '0';
      responseRef.current.style.transform = 'translateY(8px)';
    }
    streamLines.forEach(line => {
      line.style.opacity = '0';
      line.style.transform = 'translateX(-6px)';
    });
    if (footerRef.current) footerRef.current.style.opacity = '0';

    // Seeking back to 0 does not undo the typing `update` callbacks, so
    // lines typed in the previous pass would sit there fully written
    // until their turn came round again.
    const clearRequest = () => requestLines.forEach(line => (line.textContent = ''));
    const tl = anime.timeline({
      easing: 'easeOutQuart',
      loop: true,
      loopBegin: clearRequest,
    });

    // 1. Type each request line character-by-character. anime.js doesn't
    //    ship a typing primitive — we drive a numeric `progress` from 0→1
    //    per line and slice the stored `data-full` text accordingly.
    requestLines.forEach((line, i) => {
      const full = line.dataset.full ?? '';
      tl.add({
        targets: { p: 0 },
        p: 1,
        duration: Math.max(200, full.length * 9),
        easing: 'linear',
        delay: i === 0 ? 350 : 80,
        update: anim => {
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
      '+=250'
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
      '+=180'
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
      '+=200'
    );

    // anime v3 has no loopDelay, so hold the finished run on screen with
    // a trailing pause; without it the loop wiped the stream ~1s after
    // it appeared.
    tl.add({ duration: 4500 });

    timelineRef.current = tl;
    replayRef.current = () => {
      clearRequest();
      tl.restart();
    };

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
      className="relative mx-auto w-full max-w-xl lg:mx-0 lg:ml-auto"
    >
      {/* Ambient emerald halo around the whole card */}
      <div
        aria-hidden="true"
        className="from-primary/[0.08] to-primary/[0.04] absolute -inset-6 rounded-3xl bg-gradient-to-b via-transparent blur-2xl"
      />

      <div className="border-border bg-card/80 relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/40 backdrop-blur-md">
        {/* Title bar — traffic lights + endpoint badge. The method pill
            uses the same accent as the primary CTA so the eye links them
            visually (press button → this endpoint runs). */}
        <div className="border-border/70 bg-card/60 flex items-center gap-3 border-b px-4 py-3 sm:px-5">
          <div aria-hidden="true" className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <div
            aria-hidden="true"
            className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:justify-start"
          >
            <span className="bg-primary/15 border-primary/30 text-primary shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold sm:text-[11px]">
              {s.requestMethod}
            </span>
            <span className="text-foreground/70 truncate font-mono text-[11px] sm:text-xs">
              {s.requestUrl}
            </span>
          </div>
          <button
            type="button"
            onClick={() => replayRef.current()}
            aria-label={lang === 'es' ? 'Repetir la demo' : 'Replay the demo'}
            title={lang === 'es' ? 'Repetir' : 'Replay'}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-primary/60 shrink-0 rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Request pane */}
        <div aria-hidden="true" className="border-border/70 border-b px-4 py-4 sm:px-5">
          <div className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
            {s.requestLabel}
          </div>
          <pre
            ref={requestRef}
            className="text-foreground/90 overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed sm:text-xs"
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
          aria-hidden="true"
          className="border-border/70 border-b px-4 py-4 sm:px-5"
          style={{ opacity: 0, transform: 'translateY(8px)' }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
              {s.responseLabel}
            </span>
            <span className="font-mono text-[10px] text-emerald-400">{s.responseStatus}</span>
          </div>
          <pre className="text-foreground/90 overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed sm:text-xs">
            {s.responseBody.join('\n')}
          </pre>
        </div>

        {/* Stream pane — each line pops in with an emerald arrow */}
        <div ref={streamRef} aria-hidden="true" className="px-4 py-4 sm:px-5">
          <div className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
            {s.streamLabel}
          </div>
          <div className="space-y-1.5">
            {s.streamSteps.map((line, i) => (
              <div
                key={i}
                data-stream-line
                className="font-mono text-[11px] text-emerald-300/90 sm:text-xs"
                style={{ opacity: 0, transform: 'translateX(-6px)' }}
              >
                {line}
              </div>
            ))}
          </div>
          <div
            ref={footerRef}
            className="border-border/60 text-muted-foreground mt-3 border-t pt-3 font-mono text-[10px] sm:text-[11px]"
            style={{ opacity: 0 }}
          >
            {s.streamFooter}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
