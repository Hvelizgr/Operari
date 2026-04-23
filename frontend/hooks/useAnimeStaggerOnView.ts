'use client';

import anime from 'animejs';
import { useEffect, useRef } from 'react';

/**
 * IntersectionObserver + anime.js stagger, wired for the "reveal this
 * section as the user scrolls to it" pattern used across the marketing
 * landing.
 *
 * Why a hook instead of framer-motion `whileInView`:
 *   - Cross-component animation choreography reads cleaner when the
 *     orchestration is JS-native (single timeline, no prop-threaded
 *     variants).
 *   - anime.js stagger is measurably cheaper than framer's reconciler
 *     pass when dozens of elements enter together (the comparison
 *     table + the tools chips both have 10-20 children).
 *   - Consistent with the Hero which already uses anime.js — less
 *     context-switching for a reader scanning the landing bundle.
 *
 * Usage:
 *
 *   const ref = useAnimeStaggerOnView<HTMLDivElement>({
 *     selector: '[data-stagger]',
 *     from: { opacity: 0, translateY: 16 },
 *     to:   { opacity: 1, translateY: 0 },
 *     stagger: 80,
 *     rootMargin: '-80px',
 *   });
 *
 *   return <div ref={ref}>{items.map(... data-stagger ...)}</div>;
 *
 * The hook sets every target to its `from` state synchronously before
 * paint (via the initial useEffect pass) so there's no flash of "final
 * state" before the animation runs.
 */
export interface AnimeStaggerOnViewOptions {
  /** CSS selector for the children to animate. */
  selector: string;
  /** Styles to set on each target before the animation starts. */
  from: Record<string, number | string | (number | string)[]>;
  /** Animation end state. */
  to: Record<string, number | string | (number | string)[]>;
  /** Per-item stagger in ms. Default 80. */
  stagger?: number;
  /** Duration of each item's animation in ms. Default 520. */
  duration?: number;
  /** Delay before the first item fires in ms. Default 80. */
  delay?: number;
  /** anime.js easing string. Default `easeOutQuart`. */
  easing?: string;
  /** IntersectionObserver rootMargin. Default `-80px`. */
  rootMargin?: string;
  /** Only fire once (default true — matches the prior framer behavior). */
  once?: boolean;
}

export function useAnimeStaggerOnView<T extends HTMLElement>(options: AnimeStaggerOnViewOptions) {
  const ref = useRef<T | null>(null);
  const playedRef = useRef(false);

  const {
    selector,
    from,
    to,
    stagger = 80,
    duration = 520,
    delay = 80,
    easing = 'easeOutQuart',
    rootMargin = '-80px',
    once = true,
  } = options;

  // Snap children to the `from` state before paint so SSR output doesn't
  // flash visible before the observer fires. We run this in a layout-ish
  // useEffect (sync after commit, before the next frame) to minimize the
  // visible gap.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>(selector);
    targets.forEach(el => {
      Object.entries(from).forEach(([k, v]) => {
        // opacity + scalar styles get applied directly; transform
        // fields are composed so multiple transforms don't stomp.
        if (k === 'opacity') el.style.opacity = String(v);
        else if (k === 'translateX' || k === 'translateY' || k === 'scale') {
          const existing = el.style.transform || '';
          const unit = k === 'scale' ? '' : 'px';
          el.style.transform = `${existing} ${k}(${v}${unit})`.trim();
        }
      });
      el.style.willChange = 'transform, opacity';
    });
  }, [selector, from]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (once && playedRef.current) return;
          playedRef.current = true;

          anime({
            targets: root.querySelectorAll<HTMLElement>(selector),
            ...to,
            duration,
            easing,
            delay: anime.stagger(stagger, { start: delay }),
            complete: () => {
              // Drop will-change so the browser can release
              // the compositor layer once the anim settles.
              root
                .querySelectorAll<HTMLElement>(selector)
                .forEach(el => (el.style.willChange = 'auto'));
            },
          });

          if (once) observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.05 }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [selector, to, stagger, duration, delay, easing, rootMargin, once]);

  return ref;
}
