'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import type { ViewportState } from '../../types/editor.types';
import * as Icons from 'lucide-react';

export type BadgeStyle = 'minimal' | 'pill' | 'icon-only' | 'status-dot' | 'label';

interface ConnectionBubblesLayerProps {
    connections: Connection[];
    nodes: WorkflowNode[];
    viewport: ViewportState;
    selectedConnection?: string | null;
    onConnectionClick?: (connectionId: string) => void;
    onBubbleClick?: (connectionId: string) => void;
    badgeStyle?: BadgeStyle;
}

const getNodePortPosition = (node: WorkflowNode, portType: string) => {
    const type = node.type.toLowerCase();
    if (type.includes('trigger') || type === 'start') {
        if (portType === 'input') return { x: node.position.x, y: node.position.y + 32 };
        return { x: node.position.x + 64, y: node.position.y + 32 };
    }
    if (type.includes('controller') || type === 'condition') {
        if (portType === 'input') return { x: node.position.x, y: node.position.y + 32 };
        return { x: node.position.x + 128, y: node.position.y + 32 };
    }
    if (type.includes('limit')) {
        if (portType === 'input') return { x: node.position.x + 32, y: node.position.y };
        return { x: node.position.x + 32, y: node.position.y + 64 };
    }
    if (portType === 'input') return { x: node.position.x, y: node.position.y + 60 };
    return { x: node.position.x + 275, y: node.position.y + 60 };
};

const getBezierMidpoint = (start: { x: number, y: number }, end: { x: number, y: number }) => {
    const halfWayX = (start.x + end.x) / 2;
    const t = 0.5;
    const invT = 1 - t;
    const c0 = invT * invT * invT;
    const c1 = 3 * invT * invT * t;
    const c2 = 3 * invT * t * t;
    const c3 = t * t * t;
    const p1 = { x: halfWayX, y: start.y };
    const p2 = { x: halfWayX, y: end.y };
    const x = c0 * start.x + c1 * p1.x + c2 * p2.x + c3 * end.x;
    const y = c0 * start.y + c1 * p1.y + c2 * p2.y + c3 * end.y;
    return { x, y };
};

const CONDITION_CONFIG: Record<string, { 
    color: string; 
    bgColor: string;
    icon: keyof typeof Icons; 
    label: string;
    glowColor: string;
}> = {
    complete: { 
        color: '#ffffff', 
        bgColor: '#3b82f6', 
        icon: 'Circle', 
        label: 'Complete',
        glowColor: 'rgba(59, 130, 246, 0.5)'
    },
    success: { 
        color: '#ffffff', 
        bgColor: '#22c55e', 
        icon: 'Check', 
        label: 'Success',
        glowColor: 'rgba(34, 197, 94, 0.5)'
    },
    error: { 
        color: '#ffffff', 
        bgColor: '#ef4444', 
        icon: 'X', 
        label: 'Error',
        glowColor: 'rgba(239, 68, 68, 0.5)'
    },
    warning: { 
        color: '#000000', 
        bgColor: '#eab308', 
        icon: 'AlertTriangle', 
        label: 'Warning',
        glowColor: 'rgba(234, 179, 8, 0.5)'
    },
    disabled: { 
        color: '#ffffff', 
        bgColor: '#6b7280', 
        icon: 'Ban', 
        label: 'Disabled',
        glowColor: 'rgba(107, 114, 128, 0.5)'
    },
    start: { 
        color: '#ffffff', 
        bgColor: '#8b5cf6', 
        icon: 'Play', 
        label: 'Start',
        glowColor: 'rgba(139, 92, 246, 0.5)'
    },
    conditional: { 
        color: '#ffffff', 
        bgColor: '#f97316', 
        icon: 'GitBranch', 
        label: 'Conditional',
        glowColor: 'rgba(249, 115, 22, 0.5)'
    },
    loop: { 
        color: '#ffffff', 
        bgColor: '#06b6d4', 
        icon: 'RefreshCw', 
        label: 'Loop',
        glowColor: 'rgba(6, 182, 212, 0.5)'
    },
};

function MinimalBadge({ config, isSelected, Icon }: { config: typeof CONDITION_CONFIG[string]; isSelected: boolean; Icon: any }) {
    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.2 }}
            style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: config.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isSelected ? `0 0 0 3px ${config.glowColor}, 0 2px 8px ${config.glowColor}` : `0 2px 4px rgba(0,0,0,0.3)`,
                border: '2px solid rgba(255,255,255,0.2)',
            }}
        >
            <Icon size={10} color={config.color} strokeWidth={3} />
        </motion.div>
    );
}

function PillBadge({ config, isSelected, Icon }: { config: typeof CONDITION_CONFIG[string]; isSelected: boolean; Icon: any }) {
    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 12,
                backgroundColor: config.bgColor,
                boxShadow: isSelected ? `0 0 0 2px ${config.glowColor}` : '0 2px 4px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.15)',
            }}
        >
            <Icon size={10} color={config.color} strokeWidth={2.5} />
            <span style={{ fontSize: 9, fontWeight: 600, color: config.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {config.label}
            </span>
        </motion.div>
    );
}

function IconOnlyBadge({ config, isSelected, Icon }: { config: typeof CONDITION_CONFIG[string]; isSelected: boolean; Icon: any }) {
    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.3, rotate: 5 }}
            style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                backgroundColor: config.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isSelected 
                    ? `0 0 12px ${config.glowColor}, 0 0 0 2px ${config.bgColor}` 
                    : '0 2px 6px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            <Icon size={14} color={config.color} strokeWidth={2.5} />
        </motion.div>
    );
}

function StatusDotBadge({ config, isSelected }: { config: typeof CONDITION_CONFIG[string]; isSelected: boolean; Icon: any }) {
    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{ position: 'relative' }}
        >
            <motion.div
                animate={{ 
                    boxShadow: isSelected 
                        ? [`0 0 0 0 ${config.glowColor}`, `0 0 0 8px transparent`]
                        : `0 0 4px ${config.glowColor}`
                }}
                transition={{ 
                    duration: 1.5, 
                    repeat: isSelected ? Infinity : 0,
                    ease: 'easeOut'
                }}
                style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: config.bgColor,
                    border: '2px solid rgba(255,255,255,0.3)',
                }}
            />
        </motion.div>
    );
}

function LabelBadge({ config, isSelected, Icon }: { config: typeof CONDITION_CONFIG[string]; isSelected: boolean; Icon: any }) {
    const [hovered, setHovered] = useState(false);
    
    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
            }}
        >
            <motion.div
                animate={{ scale: hovered ? 1.2 : 1 }}
                style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    backgroundColor: config.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isSelected ? `0 0 8px ${config.glowColor}` : '0 2px 4px rgba(0,0,0,0.3)',
                    border: '2px solid rgba(255,255,255,0.2)',
                }}
            >
                <Icon size={12} color={config.color} strokeWidth={2.5} />
            </motion.div>
            <AnimatePresence>
                {hovered && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        style={{
                            fontSize: 8,
                            fontWeight: 600,
                            color: config.bgColor,
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {config.label}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default function ConnectionBubblesLayer({
    connections,
    nodes,
    viewport,
    selectedConnection,
    onConnectionClick,
    onBubbleClick,
    badgeStyle = 'minimal'
}: ConnectionBubblesLayerProps) {
    return (
        <motion.div
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            animate={{
                x: viewport.x,
                y: viewport.y,
                scale: viewport.zoom,
            }}
            transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
            }}
            style={{ transformOrigin: '0 0' }}
        >
            {connections.map(conn => {
                const sourceNode = nodes.find(n => n.id === conn.source);
                const targetNode = nodes.find(n => n.id === conn.target);
                if (!sourceNode || !targetNode) return null;

                const start = getNodePortPosition(sourceNode, 'output');
                const end = getNodePortPosition(targetNode, 'input');
                const mid = getBezierMidpoint(start, end);

                const conditionType = (conn as any).condition || (conn as any).data?.condition || 'complete';
                const config = CONDITION_CONFIG[conditionType] || CONDITION_CONFIG.complete;
                const IconComponent = (Icons as any)[config.icon] || Icons.Circle;
                const isSelected = selectedConnection === conn.id;

                const handleClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (onBubbleClick) {
                        onBubbleClick(conn.id);
                    } else {
                        onConnectionClick?.(conn.id);
                    }
                };

                const offsetX = badgeStyle === 'pill' ? 30 : badgeStyle === 'label' ? 11 : 10;
                const offsetY = badgeStyle === 'label' ? 14 : 10;

                return (
                    <div
                        key={conn.id}
                        style={{
                            position: 'absolute',
                            left: mid.x - offsetX,
                            top: mid.y - offsetY,
                            pointerEvents: 'auto',
                            cursor: 'pointer',
                            zIndex: isSelected ? 20 : 10,
                        }}
                        onClick={handleClick}
                    >
                        {badgeStyle === 'minimal' && <MinimalBadge config={config} isSelected={isSelected} Icon={IconComponent} />}
                        {badgeStyle === 'pill' && <PillBadge config={config} isSelected={isSelected} Icon={IconComponent} />}
                        {badgeStyle === 'icon-only' && <IconOnlyBadge config={config} isSelected={isSelected} Icon={IconComponent} />}
                        {badgeStyle === 'status-dot' && <StatusDotBadge config={config} isSelected={isSelected} Icon={IconComponent} />}
                        {badgeStyle === 'label' && <LabelBadge config={config} isSelected={isSelected} Icon={IconComponent} />}
                    </div>
                );
            })}
        </motion.div>
    );
}
