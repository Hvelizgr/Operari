'use client';

import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
    onResetZoom: () => void;
    lang: 'en' | 'es';
}

export default function ZoomControls({ zoom, onZoomIn, onZoomOut, onFitView, onResetZoom, lang }: ZoomControlsProps) {
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
            className="absolute bottom-4 right-4 flex flex-col gap-2 z-30"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
        >
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
                <div className="px-3 py-2 text-center bg-slate-900 border-b border-slate-700">
                    <span className="text-xs font-mono text-slate-300">{Math.round(zoom * 100)}%</span>
                </div>

                <div className="flex flex-col">
                    <button
                        onClick={onZoomIn}
                        className="p-2 hover:bg-slate-700 text-slate-200 transition-colors border-b border-slate-700/50"
                        title={text.zoomIn}
                    >
                        <ZoomIn size={18} />
                    </button>

                    <button
                        onClick={onZoomOut}
                        className="p-2 hover:bg-slate-700 text-slate-200 transition-colors border-b border-slate-700/50"
                        title={text.zoomOut}
                    >
                        <ZoomOut size={18} />
                    </button>

                    <button
                        onClick={onFitView}
                        className="p-2 hover:bg-slate-700 text-slate-200 transition-colors border-b border-slate-700/50"
                        title={text.fitView}
                    >
                        <Maximize2 size={18} />
                    </button>

                    <button
                        onClick={onResetZoom}
                        className="p-2 hover:bg-slate-700 text-slate-200 transition-colors"
                        title={text.resetZoom}
                    >
                        <RotateCcw size={18} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
