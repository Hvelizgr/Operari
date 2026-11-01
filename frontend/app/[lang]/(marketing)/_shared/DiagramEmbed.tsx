'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Maximize2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * An Archify diagram from public/diagrams/. Each one is a standalone page
 * with its own pan/zoom, theme and source links, so it is framed rather
 * than re-implemented.
 *
 * Below md the interactive viewer is unusable (toolbar clipped, light
 * theme by default, labels unreadable), so phones get the animated SVG
 * export of the same diagram (`<name>.svg` next to `<name>.html`) and a
 * button into the full viewer instead.
 */
export default function DiagramEmbed({
  src,
  frameTitle,
  open,
  note,
  heightClass = 'h-[520px] sm:h-[720px]',
}: {
  src: string;
  frameTitle: string;
  open: string;
  note: string;
  heightClass?: string;
}) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const theme = useSiteTheme();
  const params = useParams();
  const es = params?.lang === 'es';
  const themedSrc = `${src}?theme=${theme}`;
  const poster = src.replace(/\.html$/, '.svg');

  return (
    <div>
      <div className="border-border/60 bg-card/40 relative overflow-hidden rounded-2xl border">
        {desktop ? (
          <iframe
            key={themedSrc}
            src={themedSrc}
            title={frameTitle}
            loading="lazy"
            className={`block w-full ${heightClass}`}
          />
        ) : (
          <a href={themedSrc} target="_blank" rel="noopener" className="group block">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="bg-[#050814] p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- animated SVG, CSS motion runs only as a plain img */}
              <img src={poster} alt={frameTitle} loading="lazy" className="block h-auto w-full" />
            </motion.div>
            <span className="bg-primary text-primary-foreground shadow-primary/30 absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-lg transition-transform group-active:scale-95">
              <Maximize2 className="h-3.5 w-3.5" />
              {es ? 'Abrir interactivo' : 'Open interactive'}
            </span>
          </a>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{note}</p>
        <a
          href={themedSrc}
          target="_blank"
          rel="noopener"
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium"
        >
          {open}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return match;
}

function useSiteTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}
