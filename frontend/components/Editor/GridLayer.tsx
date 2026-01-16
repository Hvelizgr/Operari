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
            className="absolute top-0 left-0 w-full h-full pointer-events-none transition-opacity duration-300"
            style={{ zIndex: 0 }}
        >
            <defs>
                <pattern
                    id="grid"
                    width={20 * viewport.zoom}
                    height={20 * viewport.zoom}
                    patternUnits="userSpaceOnUse"
                >
                    <circle
                        cx={2 * viewport.zoom}
                        cy={2 * viewport.zoom}
                        r={1}
                        fill="rgba(128,130,132,0.55)"
                    />
                </pattern>
            </defs>
            <motion.rect
                width="100%"
                height="100%"
                fill="url(#grid)"
                animate={{
                    x: viewport.x % (20 * viewport.zoom),
                    y: viewport.y % (20 * viewport.zoom),
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
