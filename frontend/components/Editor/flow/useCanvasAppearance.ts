'use client';

import { useEffect, useState } from 'react';

import { readFlowSpeedMult, readPrefs, type RenderPrefs } from '../../../utils/canvas/prefs';

export type BackgroundPattern = 'dots' | 'grid' | 'lines' | 'none';

export interface CanvasAppearance {
  edges: RenderPrefs;
  flowSpeedMult: number;
  background: { pattern: BackgroundPattern; size: number; opacity: number };
}

function readBackground(html: HTMLElement): CanvasAppearance['background'] {
  const raw = html.getAttribute('data-bg-pattern');
  const pattern: BackgroundPattern =
    raw === 'grid' ? 'grid' : raw === 'lines' ? 'lines' : raw === 'none' ? 'none' : 'dots';
  const size = parseFloat(html.style.getPropertyValue('--grid-size').trim());
  const opacity = parseFloat(html.style.getPropertyValue('--grid-opacity').trim());
  return {
    pattern,
    size: Number.isFinite(size) && size > 0 ? size : 20,
    opacity: Number.isFinite(opacity) ? opacity : 0.55,
  };
}

function read(): CanvasAppearance {
  return {
    edges: readPrefs(),
    flowSpeedMult: readFlowSpeedMult(),
    background: readBackground(document.documentElement),
  };
}

/**
 * The Appearance page writes its choices to <html> as data-* attributes
 * and CSS custom properties. Observe them so flipping a setting restyles
 * the open canvas without a reload. Null until mounted (SSR has no DOM).
 */
export function useCanvasAppearance(): CanvasAppearance | null {
  const [appearance, setAppearance] = useState<CanvasAppearance | null>(null);

  useEffect(() => {
    // `style` on <html> also changes for unrelated theme vars; keep the
    // previous object when nothing we read moved so edges don't re-render.
    const sync = () =>
      setAppearance(prev => {
        const next = read();
        return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        'style',
        'data-bg-pattern',
        'data-line-style',
        'data-flow-style',
        'data-edge-dash',
        'data-edge-arrow',
        'data-flow',
        'data-anim',
      ],
    });
    return () => observer.disconnect();
  }, []);

  return appearance;
}
