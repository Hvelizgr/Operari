import { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { ViewportState } from '../../types/editor.types';

interface GridLayerProps {
  viewport: ViewportState;
  highContrast: boolean;
}

type Pattern = 'dots' | 'grid' | 'lines' | 'none';

/**
 * Canvas background pattern. Driven by the Appearance page via
 * `data-bg-pattern`, `--grid-size` and `--grid-opacity` on <html>.
 * Subscribes to a MutationObserver so flipping the pattern in
 * Settings → Appearance → Canvas re-renders the SVG immediately
 * without a full editor reload.
 */
function GridLayer({ viewport, highContrast: _highContrast }: GridLayerProps) {
  const [pattern, setPattern] = useState<Pattern>('dots');
  const [size, setSize] = useState(20);
  const [opacity, setOpacity] = useState(0.55);

  useEffect(() => {
    const html = document.documentElement;

    const read = () => {
      const raw = html.getAttribute('data-bg-pattern');
      setPattern(
        raw === 'grid' ? 'grid' : raw === 'lines' ? 'lines' : raw === 'none' ? 'none' : 'dots'
      );
      const rawSize = html.style.getPropertyValue('--grid-size').trim();
      const parsedSize = parseFloat(rawSize);
      if (Number.isFinite(parsedSize) && parsedSize > 0) {
        setSize(parsedSize);
      }
      const rawOpacity = html.style.getPropertyValue('--grid-opacity').trim();
      const parsedOpacity = parseFloat(rawOpacity);
      if (Number.isFinite(parsedOpacity)) {
        setOpacity(parsedOpacity);
      }
    };

    read();

    const observer = new MutationObserver(read);
    observer.observe(html, {
      attributes: true,
      attributeFilter: ['data-bg-pattern', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  if (pattern === 'none') return null;

  const worldSize = size * viewport.zoom;
  const strokeColor = `rgba(128, 130, 132, ${opacity})`;
  const faintStroke = `rgba(128, 130, 132, ${opacity * 0.5})`;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 h-full w-full transition-opacity duration-300"
      style={{ zIndex: 0 }}
    >
      <defs>
        {pattern === 'dots' && (
          <pattern id="grid" width={worldSize} height={worldSize} patternUnits="userSpaceOnUse">
            <circle cx={2 * viewport.zoom} cy={2 * viewport.zoom} r={1} fill={strokeColor} />
          </pattern>
        )}
        {pattern === 'grid' && (
          <pattern id="grid" width={worldSize} height={worldSize} patternUnits="userSpaceOnUse">
            <path
              d={`M ${worldSize} 0 L 0 0 0 ${worldSize}`}
              fill="none"
              stroke={faintStroke}
              strokeWidth="1"
            />
          </pattern>
        )}
        {pattern === 'lines' && (
          <pattern id="grid" width={worldSize} height={worldSize} patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2={worldSize} y2="0" stroke={faintStroke} strokeWidth="1" />
          </pattern>
        )}
      </defs>
      <motion.rect
        width="100%"
        height="100%"
        fill="url(#grid)"
        animate={{
          x: viewport.x % worldSize,
          y: viewport.y % worldSize,
        }}
        transition={{
          type: 'tween',
          duration: 0,
        }}
      />
    </svg>
  );
}

export default memo(GridLayer);
