
import { useRef, MouseEvent, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    MoreHorizontal, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { NodeType } from './NodePalette';
import { NODE_TYPES } from './NodePalette';

export interface WorkflowNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    title: string;
    config?: Record<string, any>;
    executionState?: 'idle' | 'running' | 'success' | 'error';
    executionData?: any;
    inputs?: any[];
    outputs?: any[];
}

interface EditorNodeProps {
    node: WorkflowNode;
    typeDefinition?: NodeType;
    onDragStart: (nodeId: string, e: MouseEvent) => void;
    onDrag: (e: MouseEvent) => void;
    onDragEnd: (nodeId: string) => void;
    isDragging: boolean;
    onPortDragStart: (nodeId: string, portId: string, type: 'source' | 'target', pos: { x: number; y: number }) => void;
    onPortDragEnd?: () => void;
    isConnectionTarget?: boolean;
    isSelected: boolean;
    isHighlighted: boolean;
    onClick: (nodeId: string) => void;
    onContextMenu?: (e: MouseEvent, nodeId: string) => void;
    onMove: (nodeId: string, direction: 'up' | 'down' | 'left' | 'right') => void;
}

// Helpers for connection lines (used by parent Canvas)
// Updated to match the new visual anchor points
export const getNodeInputPort = (node: WorkflowNode, portIndex: number = 0) => {
    // Left center
    return { x: node.position.x, y: node.position.y + 36 };
};

export const getNodeOutputPort = (node: WorkflowNode, portIndex: number = 0) => {
    // Right center
    return { x: node.position.x + 220, y: node.position.y + 36 };
};

export default function EditorNode({
    node,
    typeDefinition,
    onDragStart,
    // onDrag, // consumed by motion directly or parent
    // onDragEnd,
    isDragging,
    onPortDragStart,
    isConnectionTarget,
    isSelected,
    isHighlighted,
    onClick,
    onContextMenu,
}: EditorNodeProps) {
    // 1. Resolve Node Type Information
    const nodeType = typeDefinition || NODE_TYPES.find(t => t.type === node.type);
    const nodeColor = nodeType?.color || 'bg-slate-600';

    // 2. Resolve Ports (Inputs/Outputs)
    // If not in DB definition, fallback to basic Trigger/Action logic
    // 2. Resolve Ports (Inputs/Outputs) with Normalization
    const rawInputs = (nodeType?.inputs as any[]) ||
        (node?.type.toLowerCase().includes('trigger') ? [] : ['main']);
    const inputPorts = rawInputs.map(p => typeof p === 'string' ? { name: p, type: p } : p);

    const rawOutputs = (nodeType?.outputs as any[]) || ['main'];
    const outputPorts = rawOutputs.map(p => typeof p === 'string' ? { name: p, type: p } : p);

    // 3. Render Handle Helper
    const renderHandle = (port: any, index: number, isInput: boolean) => {
        const isMain = port.type === 'main';
        // AI ports (or anything not main) go to bottom
        const isBottom = !isMain;

        // Style Logic
        let shapeClass = "rounded-full"; // Default circle
        const sizeClass = "w-3 h-3";
        let colorClass = isInput ? "bg-slate-200 border-slate-500" : "bg-slate-200 border-slate-500";

        if (isBottom) {
            shapeClass = "rotate-45 rounded-[2px]"; // Diamond
            colorClass = "bg-purple-400 border-purple-600 shadow-sm shadow-purple-500/50";
        }

        // Position Logic
        let style: React.CSSProperties = {};

        if (isMain) {
            style = {
                top: '50%',
                marginTop: '-6px', // half height
                [isInput ? 'left' : 'right']: '-6px', // half width overlap
            };
            // Main inputs allow "+" hover
        } else {
            // Bottom ports distributed
            const relevantPorts = isInput ? inputPorts.filter(p => p.type !== 'main') : outputPorts.filter(p => p.type !== 'main');
            const idx = relevantPorts.indexOf(port);
            const count = relevantPorts.length;
            // Distribute evenly
            const step = 100 / (count + 1);
            style = {
                bottom: '-6px',
                left: `${step * (idx + 1)}%`,
                marginLeft: '-6px',
            };
        }

        return (
            <div
                key={`${isInput ? 'in' : 'out'}-${port.name}-${index}`}
                className={`absolute ${sizeClass} ${shapeClass} ${colorClass} border transition-all z-20 cursor-crosshair flex items-center justify-center group/handle`}
                style={style}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    onPortDragStart(node.id, port.name, isInput ? 'target' : 'source', {
                        x: rect.x + rect.width / 2,
                        y: rect.y + rect.height / 2
                    });
                }}
            >
                {/* Port Label Tooltip (Always visible for AI/Bottom ports) */}
                {isBottom && (
                    <div className="absolute top-4 text-[9px] font-bold text-slate-400 whitespace-nowrap bg-slate-900/90 px-1.5 py-0.5 rounded pointer-events-none uppercase tracking-wider shadow-sm border border-slate-800">
                        {port.label || port.name}
                    </div>
                )}

                {/* Hover Add Button (Only for main outputs usually, or main inputs) */}
                {isMain && !isDragging && (
                    <div className="hidden group-hover/handle:flex absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-500 text-white rounded-full w-4 h-4 items-center justify-center text-[10px] shadow-sm animate-in fade-in zoom-in duration-200">
                        +
                    </div>
                )}
            </div>
        );
    };

    return (
        <motion.div
            className={`
                absolute w-[220px] rounded-xl flex flex-col
                group transition-all duration-200
                ${isSelected
                    ? 'ring-2 ring-orange-400 shadow-lg shadow-orange-900/20 z-30'
                    : 'hover:ring-1 hover:ring-slate-500 shadow-md shadow-black/40 z-10'}
                ${isDragging ? 'cursor-grabbing scale-105 z-50' : 'cursor-grab'}
                bg-[#18181b] border border-slate-700
            `}
            style={{ x: node.position.x, y: node.position.y }}
            initial={false}
            onMouseDown={(e) => onDragStart(node.id, e)}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick(node.id);
            }}
            onContextMenu={(e) => onContextMenu && onContextMenu(e, node.id)}
        >
            {/* --- HEADER --- */}
            <div className="flex items-center gap-3 p-3 select-none">
                {/* Icon Container */}
                <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center shadow-inner text-white shrink-0
                    ${nodeColor}
                `}>
                    {nodeType?.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-[13px] font-bold text-slate-100 truncate leading-tight">
                        {node.title}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                        {nodeType?.description?.en || node.type.split('.').pop()}
                    </div>
                </div>

                {/* Status */}
                {node.executionState && node.executionState !== 'idle' && (
                    <div className="absolute -top-1 -right-1 bg-slate-900 rounded-full border border-slate-700 p-0.5 shadow-sm">
                        {node.executionState === 'running' && <Loader2 size={14} className="text-blue-400 animate-spin" />}
                        {node.executionState === 'success' && <CheckCircle2 size={14} className="text-emerald-500" />}
                        {node.executionState === 'error' && <AlertCircle size={14} className="text-rose-500" />}
                    </div>
                )}
            </div>

            {/* --- OPTIONAL BODY --- */}
            {/* Useful for displaying small params later */}
            {/* <div className="px-3 pb-2 text-[10px] text-slate-400">
                Some details...
            </div> */}

            {/* Settings Hover */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <MoreHorizontal size={14} className="text-slate-500 hover:text-slate-300" />
            </div>

            {/* --- PORTS --- */}
            {inputPorts.map((p, i) => renderHandle(p, i, true))}
            {outputPorts.map((p, i) => renderHandle(p, i, false))}

        </motion.div>
    );
}
