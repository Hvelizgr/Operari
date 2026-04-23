'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useState } from 'react';

type Entry = {
  name: string;
  purpose: string;
  region: string;
  dataTypes: string;
};

type PinRegion = {
  id: string;
  label: string;
  /** SVG viewBox is 1000x500 (equirectangular-ish proportions) */
  x: number;
  y: number;
  matches: (entry: Entry) => boolean;
};

const PIN_REGIONS: PinRegion[] = [
  {
    id: 'us-east',
    label: 'US East',
    x: 280,
    y: 200,
    matches: e => /us|united states|america|east/i.test(e.region),
  },
  {
    id: 'eu-west',
    label: 'EU / Ireland',
    x: 510,
    y: 175,
    matches: e => /eu|europe|ireland|germany|france|uk/i.test(e.region),
  },
  {
    id: 'ap-southeast',
    label: 'AP Southeast',
    x: 770,
    y: 290,
    matches: e => /ap|asia|singapore|tokyo|sydney/i.test(e.region),
  },
  {
    id: 'global',
    label: 'Global edge',
    x: 500,
    y: 380,
    matches: e => /global/i.test(e.region),
  },
];

/**
 * Subprocessors map — abstract world map with pins per region.
 *
 * Distinct from a generic table: we draw a coarse SVG world (rough
 * continent rectangles, not a real shapefile — keeps deps at zero) and
 * drop a pin per data-residency region we use. Hover a pin to reveal a
 * tooltip listing the subprocessors stored there. Connector lines from
 * a central "your data" hub pulse outward so the eye lands on the pins.
 */
export default function SubprocessorsMap({ entries, lang }: { entries: Entry[]; lang: string }) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const pinsWithEntries = PIN_REGIONS.map(p => ({
    ...p,
    items: entries.filter(p.matches),
  })).filter(p => p.items.length > 0);

  return (
    <div className="border-border/60 bg-card/40 relative overflow-hidden rounded-2xl border">
      <div className="border-border/40 flex items-center justify-between border-b px-5 py-4 sm:px-6">
        <p className="text-muted-foreground font-mono text-[10px] font-semibold uppercase tracking-[0.18em]">
          {lang === 'es' ? 'Mapa de residencia' : 'Data residency map'}
        </p>
        <p className="text-primary font-mono text-xs tabular-nums">
          {pinsWithEntries.length} {lang === 'es' ? 'regiones' : 'regions'}
        </p>
      </div>

      <div className="bg-background/40 relative aspect-[2/1]">
        <svg
          viewBox="0 0 1000 500"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(62,207,142,0.18)" />
              <stop offset="100%" stopColor="rgba(62,207,142,0)" />
            </radialGradient>
            <pattern id="dotGrid" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>

          {/* Dot grid backdrop */}
          <rect width="1000" height="500" fill="url(#dotGrid)" />

          {/* Rough continent silhouettes — abstracted on purpose */}
          <g fill="rgba(62,207,142,0.06)" stroke="rgba(62,207,142,0.25)" strokeWidth="0.5">
            {/* North America */}
            <path d="M 140 110 L 320 100 L 360 180 L 320 240 L 240 270 L 200 230 L 150 200 Z" />
            {/* South America */}
            <path d="M 280 280 L 340 280 L 350 350 L 320 420 L 280 410 L 270 340 Z" />
            {/* Europe */}
            <path d="M 470 140 L 560 130 L 590 175 L 560 210 L 490 200 L 470 175 Z" />
            {/* Africa */}
            <path d="M 480 220 L 580 215 L 600 320 L 540 380 L 500 360 L 470 290 Z" />
            {/* Asia */}
            <path d="M 600 110 L 850 130 L 870 220 L 800 260 L 700 250 L 620 220 L 595 165 Z" />
            {/* Australia */}
            <path d="M 790 320 L 880 320 L 890 370 L 820 380 L 790 360 Z" />
          </g>

          {/* Center "your data" glow */}
          <circle cx="500" cy="250" r="120" fill="url(#mapGlow)" />

          {/* Connector lines from center → each pin */}
          {pinsWithEntries.map(p => (
            <motion.line
              key={`line-${p.id}`}
              x1="500"
              y1="250"
              x2={p.x}
              y2={p.y}
              stroke="rgba(62,207,142,0.4)"
              strokeWidth="1"
              strokeDasharray="2 4"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
            />
          ))}

          {/* Center hub */}
          <motion.circle
            cx="500"
            cy="250"
            r="6"
            fill="hsl(var(--primary))"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          />
          <motion.circle
            cx="500"
            cy="250"
            r="6"
            fill="hsl(var(--primary))"
            opacity="0.4"
            animate={{ scale: [1, 2.4, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
          />
        </svg>

        {/* Pins as HTML so we can hover-tooltip cleanly */}
        {pinsWithEntries.map((p, i) => {
          const left = `${(p.x / 1000) * 100}%`;
          const top = `${(p.y / 500) * 100}%`;
          const isHover = hoverId === p.id;
          return (
            <button
              key={p.id}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(p.id)}
              onBlur={() => setHoverId(null)}
              className="absolute -translate-x-1/2 -translate-y-full focus:outline-none"
              style={{ left, top }}
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                className="relative flex flex-col items-center"
              >
                <span className="bg-primary/30 absolute -bottom-1 h-3 w-3 rounded-full blur-[6px]" />
                <span className="bg-primary text-primary-foreground shadow-primary/40 relative z-[1] inline-flex h-7 w-7 items-center justify-center rounded-full shadow-md">
                  <MapPin className="h-3.5 w-3.5" />
                </span>
                <span
                  className={`mt-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${isHover ? 'text-primary' : 'text-foreground/80'}`}
                >
                  {p.label}
                </span>

                <AnimatePresence>
                  {isHover && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="border-primary/40 bg-card/95 absolute top-full z-10 mt-2 min-w-[180px] rounded-lg border p-3 text-left shadow-xl shadow-black/40 backdrop-blur-md"
                    >
                      <p className="text-primary mb-1.5 font-mono text-[10px] uppercase tracking-wider">
                        {p.label} · {p.items.length}
                      </p>
                      <ul className="space-y-1">
                        {p.items.map(it => (
                          <li key={it.name} className="text-foreground/85 text-xs">
                            {it.name}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
