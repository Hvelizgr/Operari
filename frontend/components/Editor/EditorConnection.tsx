'use client';

import { motion } from 'framer-motion';

import { Connection } from '@nanoflow/shared';
import { useEditorTheme, ConnectionPathStyle } from '@/context/EditorThemeContext';

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

const CONDITION_ICONS: Record<ConnectionCondition, string> = {
    always: '',
    success: '✓',
    error: '✗',
    true: 'T',
    false: 'F',
};

function generatePath(
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    pathStyle: ConnectionPathStyle
): string {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;

    switch (pathStyle) {
        case 'straight':
            return `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${targetPos.y}`;

        case 'step': {
            const midX = sourcePos.x + dx / 2;
            return `M ${sourcePos.x} ${sourcePos.y} H ${midX} V ${targetPos.y} H ${targetPos.x}`;
        }

        case 'smoothstep': {
            const midX = sourcePos.x + dx / 2;
            const radius = Math.min(10, Math.abs(dy) / 2, Math.abs(dx) / 4);
            
            if (Math.abs(dy) < radius * 2) {
                return `M ${sourcePos.x} ${sourcePos.y} H ${midX} V ${targetPos.y} H ${targetPos.x}`;
            }
            
            const yDir = dy > 0 ? 1 : -1;
            return `
                M ${sourcePos.x} ${sourcePos.y}
                H ${midX - radius}
                Q ${midX} ${sourcePos.y}, ${midX} ${sourcePos.y + radius * yDir}
                V ${targetPos.y - radius * yDir}
                Q ${midX} ${targetPos.y}, ${midX + radius} ${targetPos.y}
                H ${targetPos.x}
            `;
        }

        case 'bezier':
        default: {
            const controlPointOffset = Math.min(Math.abs(dx) * 0.5, 200);
            return `
                M ${sourcePos.x} ${sourcePos.y}
                C ${sourcePos.x + controlPointOffset} ${sourcePos.y},
                  ${targetPos.x - controlPointOffset} ${targetPos.y},
                  ${targetPos.x} ${targetPos.y}
            `;
        }
    }
}

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
    const { colors, config } = useEditorTheme();
    
    const path = generatePath(sourcePos, targetPos, config.connectionPathStyle);

    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) {
            onClick(connection.id);
        }
    };

    const getConditionColor = (cond: ConnectionCondition): string => {
        switch (cond) {
            case 'success': return colors.success;
            case 'error': return colors.error;
            case 'true': return colors.primary;
            case 'false': return colors.warning;
            default: return colors.edgeColor;
        }
    };

    const getStrokeColor = () => {
        if (isCyclic) return colors.error;
        if (executionStatus === 'failed') return colors.error;
        if (executionStatus === 'success') return colors.success;
        if (isSelected) return colors.primary;
        if (isExecuting) return colors.primary;
        return getConditionColor(condition);
    };

    const getGlowColor = () => {
        if (isSelected) return colors.primaryGlow;
        return colors.edgeGlow;
    };

    const getStrokeDashArray = () => {
        if (condition === 'error') return '8,4';
        if (isCyclic) return '4,4';
        return 'none';
    };

    return (
        <g onClick={handleClick} className="cursor-pointer group">
            <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth="20"
                style={{ pointerEvents: 'stroke' }}
            />

            <motion.path
                d={path}
                fill="none"
                stroke={getGlowColor()}
                strokeWidth="6"
                strokeLinecap="round"
                className="transition-colors duration-300"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
            />

            <motion.path
                d={path}
                fill="none"
                stroke={getStrokeColor()}
                strokeWidth={isCyclic ? "3" : isSelected ? "3" : "2"}
                strokeLinecap="round"
                strokeDasharray={getStrokeDashArray()}
                className="transition-colors duration-300"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            />

            <motion.circle
                cx={targetPos.x}
                cy={targetPos.y}
                r="4"
                fill={isSelected ? colors.primary : colors.edgeColor}
                className="editor-connection-dot transition-colors duration-300"
            />

            {isExecuting && (
                <>
                    <motion.circle
                        r="4"
                        fill={colors.nodeGlow}
                        className="editor-flow-packet"
                        initial={{ offsetDistance: '0%' }}
                        animate={{ offsetDistance: '100%' }}
                        transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                        style={{
                            offsetPath: `path('${path.replace(/\s+/g, ' ').trim()}')`,
                            filter: `drop-shadow(0 0 4px ${colors.primary})`
                        }}
                    />

                    <motion.circle
                        r="2"
                        fill={colors.primary}
                        className="editor-flow-tail"
                        initial={{ offsetDistance: '0%', opacity: 0 }}
                        animate={{ offsetDistance: '100%', opacity: [0, 1, 0] }}
                        transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            ease: 'linear',
                            delay: 0.1
                        }}
                        style={{
                            offsetPath: `path('${path.replace(/\s+/g, ' ').trim()}')`,
                        }}
                    />
                </>
            )}

            {condition !== 'always' && CONDITION_ICONS[condition] && (
                <g
                    transform={`translate(${midX}, ${midY})`}
                    className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={handleClick}
                >
                    <circle
                        r="8"
                        fill={getConditionColor(condition)}
                        stroke={colors.surface}
                        strokeWidth="1.5"
                        className="transition-all duration-200"
                    />
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
