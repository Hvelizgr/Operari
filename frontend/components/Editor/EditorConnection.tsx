'use client';

import { motion } from 'framer-motion';

import { Connection } from '@cairn/shared';

// Removed local Connection interface


interface EditorConnectionProps {
    connection: Connection;
    sourcePos: { x: number; y: number };
    targetPos: { x: number; y: number };
    isSelected?: boolean;
    isExecuting?: boolean;
    isCyclic?: boolean;
    onClick?: (connectionId: string) => void;
}

export default function EditorConnection({
    connection,
    sourcePos,
    targetPos,
    isSelected = false,
    isExecuting = false,
    isCyclic = false,
    onClick,
}: EditorConnectionProps) {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;

    const controlPointOffset = Math.min(Math.abs(dx) * 0.5, 200);

    const path = `
    M ${sourcePos.x} ${sourcePos.y}
    C ${sourcePos.x + controlPointOffset} ${sourcePos.y},
      ${targetPos.x - controlPointOffset} ${targetPos.y},
      ${targetPos.x} ${targetPos.y}
  `;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) {
            onClick(connection.id);
        }
    };

    const getStrokeColor = () => {
        if (isCyclic) return "#ef4444";
        if (isSelected) return "#3b82f6";
        return isExecuting ? "#60a5fa" : "#475569"; // Blue when executing, Slate-600 otherwise
    };

    return (
        <g onClick={handleClick} className="cursor-pointer group">
            {/* Invisible wide path for easier clicking */}
            <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth="20"
                style={{ pointerEvents: 'stroke' }}
            />

            {/* Glow effect under the main line */}
            <motion.path
                d={path}
                fill="none"
                stroke={isSelected ? "rgba(59, 130, 246, 0.3)" : "rgba(71, 85, 105, 0.2)"}
                strokeWidth="6"
                strokeLinecap="round"
                className="transition-colors duration-300"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
            />

            {/* Main connection line */}
            <motion.path
                d={path}
                fill="none"
                stroke={getStrokeColor()}
                strokeWidth={isCyclic ? "3" : isSelected ? "3" : "2"}
                strokeLinecap="round"
                className="group-hover:stroke-blue-400 transition-colors duration-300"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            />

            {/* Connection end dot */}
            <motion.circle
                cx={targetPos.x}
                cy={targetPos.y}
                r="4"
                fill={isSelected ? "#3b82f6" : "#475569"}
                className="group-hover:fill-blue-400 transition-colors duration-300"
            />

            {isExecuting && (
                <>
                    {/* Animated Data Packet (White/Blue glowing orb) */}
                    <motion.circle
                        r="4"
                        fill="#ffffff"
                        initial={{ offsetDistance: '0%' }}
                        animate={{ offsetDistance: '100%' }}
                        transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                        style={{
                            offsetPath: `path('${path}')`,
                            filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.8))'
                        }}
                    />

                    {/* Trailing tail */}
                    <motion.circle
                        r="2"
                        fill="#60a5fa"
                        initial={{ offsetDistance: '0%', opacity: 0 }}
                        animate={{ offsetDistance: '100%', opacity: [0, 1, 0] }}
                        transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            ease: 'linear',
                            delay: 0.1
                        }}
                        style={{
                            offsetPath: `path('${path}')`,
                        }}
                    />
                </>
            )}
        </g>
    );
}
