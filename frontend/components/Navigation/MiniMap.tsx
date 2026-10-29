'use client';

import { MiniMap as FlowMiniMap, useReactFlow } from '@xyflow/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Map, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';

import { type MinimapPosition, useVisualization } from '@/context/VisualizationContext';

interface MiniMapProps {
  lang: 'en' | 'es';
}

/** Maps the user's minimap position preference to Tailwind corner
 *  classes. Kept in-module so the MiniMap file is self-contained.
 *  Bottom-right clears the zoom controls, the floating terminal
 *  button and the status bar that share that corner. */
const POSITION_CLASSES: Record<Exclude<MinimapPosition, 'hidden'>, string> = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-16 right-24',
};

const MINIMAP_WIDTH = 240;
const MINIMAP_HEIGHT = 180;

export default function MiniMap({ lang }: MiniMapProps) {
  const { minimapPosition } = useVisualization();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const flow = useReactFlow();

  const content = {
    en: {
      minimap: 'Mini Map',
      collapse: 'Collapse',
      expand: 'Expand',
    },
    es: {
      minimap: 'Mini Mapa',
      collapse: 'Contraer',
      expand: 'Expandir',
    },
  };

  const text = content[lang] || content['en'];

  // User picked "hidden" in Appearance → Canvas → Minimap position —
  // skip rendering entirely so the minimap isn't just visually
  // offscreen but actually absent from the DOM and the tab order.
  if (minimapPosition === 'hidden') return null;

  const positionClass = POSITION_CLASSES[minimapPosition] ?? POSITION_CLASSES['bottom-left'];

  return (
    <motion.div
      className={`absolute ${positionClass} z-40`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
    >
      <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-2">
          <div className="flex items-center gap-2">
            <Map size={14} className="text-primary" />
            <span className="text-xs font-semibold text-slate-200">{text.minimap}</span>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-400 transition-colors hover:text-slate-200"
            title={isCollapsed ? text.expand : text.collapse}
          >
            {isCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <FlowMiniMap
                className="wf_minimap"
                style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
                ariaLabel={text.minimap}
                pannable
                zoomable
                onClick={(_, position) =>
                  flow.setCenter(position.x, position.y, { zoom: flow.getZoom(), duration: 300 })
                }
                nodeBorderRadius={3}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
