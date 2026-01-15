import { memo } from 'react';
import { motion } from 'framer-motion';
import { EDITOR_CONFIG } from '../../config/editor.config';
import type { ViewportState } from '../../types/editor.types';

interface GridLayerProps {
    viewport: ViewportState;
    highContrast: boolean;
}

function GridLayer({ viewport, highContrast }: GridLayerProps) {
    return (
        <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-50 transition-opacity duration-300"
            style={{ zIndex: -1 }}
        >
            <defs>
                <pattern
                    id="grid"
                    width={EDITOR_CONFIG.GRID.SIZE * viewport.zoom}
                    height={EDITOR_CONFIG.GRID.SIZE * viewport.zoom}
                    patternUnits="userSpaceOnUse"
                >
                    <circle
                        cx={EDITOR_CONFIG.GRID.SIZE * viewport.zoom / 2}
                        cy={EDITOR_CONFIG.GRID.SIZE * viewport.zoom / 2}
                        r={1}
                        fill={highContrast ? '#444' : '#ffffff20'}
                    />
                </pattern>
            </defs>
            <motion.rect
                width="100%"
                height="100%"
                fill="url(#grid)"
                animate={{
                    x: viewport.x % (EDITOR_CONFIG.GRID.SIZE * viewport.zoom),
                    y: viewport.y % (EDITOR_CONFIG.GRID.SIZE * viewport.zoom),
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
