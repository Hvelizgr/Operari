'use client';

import { motion } from 'framer-motion';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onResetZoom: () => void;
  lang: 'en' | 'es';
}

export default function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetZoom,
  lang,
}: ZoomControlsProps) {
  const content = {
    en: {
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      fitView: 'Fit View',
      resetZoom: 'Reset Zoom',
    },
    es: {
      zoomIn: 'Acercar',
      zoomOut: 'Alejar',
      fitView: 'Ajustar Vista',
      resetZoom: 'Restablecer Zoom',
    },
  };

  const text = content[lang] || content['en'];

  return (
    <motion.div
      className="absolute bottom-4 right-4 z-30 flex flex-col gap-2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-2xl">
        <div className="border-b border-slate-700 bg-slate-900 px-3 py-2 text-center">
          <span className="font-mono text-xs text-slate-300">{Math.round(zoom * 100)}%</span>
        </div>

        <div className="flex flex-col">
          <button
            onClick={onZoomIn}
            className="border-b border-slate-700/50 p-2 text-slate-200 transition-colors hover:bg-slate-700"
            title={text.zoomIn}
            aria-label={text.zoomIn}
          >
            <ZoomIn size={18} />
          </button>

          <button
            onClick={onZoomOut}
            className="border-b border-slate-700/50 p-2 text-slate-200 transition-colors hover:bg-slate-700"
            title={text.zoomOut}
            aria-label={text.zoomOut}
          >
            <ZoomOut size={18} />
          </button>

          <button
            onClick={onFitView}
            className="border-b border-slate-700/50 p-2 text-slate-200 transition-colors hover:bg-slate-700"
            title={text.fitView}
            aria-label={text.fitView}
          >
            <Maximize2 size={18} />
          </button>

          <button
            onClick={onResetZoom}
            className="p-2 text-slate-200 transition-colors hover:bg-slate-700"
            title={text.resetZoom}
            aria-label={text.resetZoom}
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
