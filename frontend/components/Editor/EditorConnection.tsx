'use client';

import { motion } from 'framer-motion';

import { Connection } from '@nanoflow/shared';

// Removed local Connection interface

// n8n-style connection conditions
export type ConnectionCondition = 'always' | 'success' | 'error' | 'true' | 'false';

interface EditorConnectionProps {
    connection: Connection;
    sourcePos: { x: number; y: number };
    targetPos: { x: number; y: number };
    isSelected?: boolean;
    isExecuting?: boolean;
    isCyclic?: boolean;
    condition?: ConnectionCondition;
    executionStatus?: 'pending' | 'success' | 'failed';
    onClick?: (connectionId: string) => void;
}

// n8n-style condition colors
const CONDITION_COLORS: Record<ConnectionCondition, string> = {
    always: '#475569',   // Slate-600 (default)
    success: '#22c55e',  // Green-500
    error: '#ef4444',    // Red-500
    true: '#3b82f6',     // Blue-500
    false: '#f59e0b',    // Amber-500
};

const CONDITION_ICONS: Record<ConnectionCondition, string> = {
    always: '',
    success: '✓',
    error: '✗',
    true: 'T',
    false: 'F',
};

export default function EditorConnection({
    connection,
    sourcePos,
    targetPos,
    isSelected = false,
    isExecuting = false,
    isCyclic = false,
    condition = 'always',
    executionStatus,
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

    // Calculate midpoint for condition badge
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) {
            onClick(connection.id);
        }
    };

    const getStrokeColor = () => {
        // Priority: cyclic > execution status > selected > condition
        if (isCyclic) return '#ef4444';
        if (executionStatus === 'failed') return '#ef4444';
        if (executionStatus === 'success') return '#22c55e';
        if (isSelected) return '#3b82f6';
        if (isExecuting) return '#60a5fa';
        return CONDITION_COLORS[condition];
    };

    const getStrokeDashArray = () => {
        // Dashed line for error conditions
        if (condition === 'error') return '8,4';
        if (isCyclic) return '4,4';
        return 'none';
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
                strokeDasharray={getStrokeDashArray()}
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

            {/* Condition indicator - small, subtle badge only on hover */}
            {condition !== 'always' && CONDITION_ICONS[condition] && (
                <g
                    transform={`translate(${midX}, ${midY})`}
                    className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={handleClick}
                >
                    {/* Badge background - smaller and more subtle */}
                    <circle
                        r="8"
                        fill={CONDITION_COLORS[condition]}
                        stroke="var(--form-background-color)"
                        strokeWidth="1.5"
                        className="transition-all duration-200"
                    />
                    {/* Badge icon */}
                    <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="8"
                        fontWeight="bold"
                        style={{ userSelect: 'none' }}
                    >
                        {CONDITION_ICONS[condition]}
                    </text>
                </g>
            )}
        </g>
    );
}
