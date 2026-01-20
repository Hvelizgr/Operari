'use client';

import { MouseEvent, useRef, useLayoutEffect, memo } from 'react';
import { NodeType } from '../Node';
import { WorkflowNode } from '@nanoflow/shared';
import './WorkflowNode.css';
import { Box, AlertCircle, ChevronRight, ChevronDown, GripVertical, Zap, Bug } from 'lucide-react';
// Export shared port utilities for use in ConnectionsLayer
export { getNodeInputPort, getNodeOutputPort, getNodePortInfo } from '../../utils/nodePortUtils';

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
    editorMode?: 'move' | 'connect';
    status?: 'RUNNING' | 'SUCCESS' | 'FAILED';
    onSolderStart?: (nodeId: string, port: 'input' | 'output', initialX?: number, initialY?: number, portIndex?: number) => void;
    onNodeDoubleClick?: (nodeId: string) => void;
    onUpdate?: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    isConnected?: boolean;
    onRunFromNode?: (nodeId: string) => void;
    lang: 'en' | 'es';
    blastRadiusStyle?: 'focused' | 'affected' | 'dimmed' | 'normal';
    heatmapStyle?: {
        backgroundColor?: string;
        borderColor?: string;
        stats?: {
            executionCount: number;
            avgDuration: number;
            successCount: number;
            failureCount: number;
        };
    };
}

function EditorNodeComponent({
    node,
    typeDefinition,
    onDragStart,
    isDragging,
    isSelected,
    isHighlighted,
    onClick,
    onContextMenu,
    editorMode = 'move',
    status,
    onSolderStart,
    onNodeDoubleClick,
    onUpdate,
    isConnected = true,
    onPortDragStart,
    onRunFromNode,
    lang,
    blastRadiusStyle = 'normal',
    heatmapStyle,
}: EditorNodeProps) {
    const nodeRef = useRef<HTMLDivElement>(null);
    const nodeType = typeDefinition;

    // Measure Height
    const lastHeightRef = useRef<number>((node as any).dimensions?.height || 0);
    useLayoutEffect(() => {
        if (!nodeRef.current || !onUpdate || isDragging) return;

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const element = entry.target as HTMLElement;
                const finalHeight = element.offsetHeight;
                const finalWidth = element.offsetWidth;

                // Sync dimensions to lastHeightRef to avoid redundant updates
                if (Math.abs(lastHeightRef.current - finalHeight) > 2 || !(node as any).dimensions) {
                    lastHeightRef.current = finalHeight;
                    onUpdate(node.id, {
                        dimensions: { height: finalHeight, width: finalWidth }
                    } as any);
                }
            }
        });

        // Trigger initial measurement
        if (nodeRef.current) {
            const h = nodeRef.current.offsetHeight;
            const w = nodeRef.current.offsetWidth;
            if (!(node as any).dimensions || Math.abs((node as any).dimensions.height - h) > 2) {
                onUpdate(node.id, { dimensions: { height: h, width: w } } as any);
            }
            observer.observe(nodeRef.current);
        }

        return () => observer.disconnect();
    }, [node.id, onUpdate, isDragging]);

    const renderIcon = (icon: any, size = 16) => {
        if (!icon) return <Box size={size} />;
        if (typeof icon === 'object' && icon !== null) return icon;
        if (typeof icon === 'function') {
            const I = icon;
            return <I size={size} />;
        }
        return <Box size={size} />;
    };

    // Determine Visual Type
    const type = node.type.toLowerCase();
    const category = (nodeType?.category || '').toLowerCase();
    let visualType = 'job';
    if (type.includes('trigger') || type === 'start' || category.includes('trigger')) visualType = 'trigger';
    else if (type.includes('controller') || type === 'condition' || category === 'logic' || category === 'control') visualType = 'controller';
    else if (type.includes('limit')) visualType = 'limit';
    else if (type.includes('action') || category.includes('action')) visualType = 'action';
    else if (category.includes('ai') || type.includes('openai') || type.includes('anthropic')) visualType = 'action'; // AI nodes as actions

    // Validation Badge
    const showValidation = !isConnected;

    const ValidationBadge = () => (
        <>
            {showValidation && (
                <div
                    className="absolute -top-2 -right-2 z-50 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center border border-white shadow-sm animate-pulse pointer-events-none"
                    title="Disconnected Node"
                >
                    <AlertCircle size={12} className="text-white" />
                </div>
            )}
            {node.breakpoint && (
                <div 
                    className="absolute -top-2 -left-2 z-50 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center border border-white shadow-lg pointer-events-none"
                    title="Breakpoint Active"
                >
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                </div>
            )}
        </>
    );


    const commonProps = {
        id: `d_wfn_${node.id}`,
        // ref: nodeRef,  <-- We will add ref to specific divs below
        style: {
            left: node.position.x,
            top: node.position.y,
            zIndex: isSelected || isDragging ? 10 : 3
        },
        onMouseDown: (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('.wf_pole_button')) return;
            if (editorMode !== 'connect') onDragStart(node.id, e);
        },
        onClick: (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('.wf_pole_button')) return;
            e.stopPropagation();
            onClick(node.id);
        },
        onDoubleClick: (e: MouseEvent) => {
            e.stopPropagation();
            onNodeDoubleClick && onNodeDoubleClick(node.id);
        },
        onContextMenu: (e: MouseEvent) => onContextMenu && onContextMenu(e, node.id),
    } as const;

    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Blast radius CSS class
    const blastRadiusClass = blastRadiusStyle === 'focused' ? 'blast-focused'
        : blastRadiusStyle === 'affected' ? 'blast-affected'
        : blastRadiusStyle === 'dimmed' ? 'blast-dimmed'
        : '';

    const heatmapOverlayStyle = heatmapStyle ? {
        backgroundColor: heatmapStyle.backgroundColor,
        borderColor: heatmapStyle.borderColor,
        boxShadow: heatmapStyle.backgroundColor ? `0 0 15px ${heatmapStyle.backgroundColor}` : undefined,
    } : {};

    // --- CONTROLLER (Pill Shape) ---
    if (visualType === 'controller') {
        const color = nodeType?.color || '#a855f7';
        return (
            <div
                ref={nodeRef}
                className={`wf_node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''} ${blastRadiusClass}`}
                {...commonProps}
            >
                <ValidationBadge />
                <div
                    className="wf_ent_controller"
                    style={{
                        border: `1px solid ${color}`,
                        background: hexToRgba(color, 0.15), // Subtle tint
                        boxShadow: `0 4px 12px ${hexToRgba(color, 0.2)}` // Colored glow
                    }}
                >
                    <div
                        className="wf_pole_button wf_input_pole"
                        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'input', e.clientX, e.clientY); }}
                    />
                    <div className="node-icon-container" style={{ color: color, background: 'transparent', boxShadow: 'none' }}>
                        {renderIcon(nodeType?.icon, 22)}
                    </div>
                    <div
                        className="wf_pole_button wf_output_pole"
                        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output', e.clientX, e.clientY); }}
                    />
                </div>
                <span className="wf_ent_label" style={{ color: 'var(--label-color)' }}>{node.title}</span>
            </div>
        );
    }

    // --- TRIGGER (Circle Shape) ---
    if (visualType === 'trigger') {
        const color = nodeType?.color || '#f97316';
        return (
            <div
                ref={nodeRef}
                className={`wf_node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''} ${blastRadiusClass}`}
                {...commonProps}
            >
                <ValidationBadge />
                <div
                    className="wf_ent_trigger"
                    style={{
                        border: `1px solid ${color}`,
                        background: hexToRgba(color, 0.15),
                        boxShadow: `0 4px 12px ${hexToRgba(color, 0.2)}`
                    }}
                >
                    <div className="node-icon-container" style={{ color: color, background: 'transparent', boxShadow: 'none' }}>
                        {renderIcon(nodeType?.icon, 28)}
                    </div>
                    <div
                        className="wf_pole_button wf_output_pole"
                        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output', e.clientX, e.clientY); }}
                    />
                </div>
                <span className="wf_ent_label" style={{ color: 'var(--label-color)' }}>{node.title}</span>
            </div>
        );
    }

    // --- JOB (Standard n8n Card) ---
    // Intelligent defaulting for inputs/outputs if not defined in nodeType
    const inputs = (() => {
        if (nodeType?.inputs && nodeType.inputs.length > 0) return nodeType.inputs;
        if (visualType === 'trigger') return [];
        return [{ name: 'main', type: 'main' }];
    })();

    const outputs = (() => {
        if (nodeType?.outputs && nodeType.outputs.length > 0) return nodeType.outputs;
        return [{ name: 'main', type: 'main' }];
    })();

    return (
        <div
            ref={nodeRef}
            className={`
                wf_node
                ${isSelected ? 'selected' : ''}
                ${isDragging ? 'dragging' : ''}
                ${status === 'RUNNING' ? 'wf_active' : ''}
                ${status === 'SUCCESS' ? 'wf_completed' : ''}
                ${status === 'FAILED' ? 'wf_error' : ''}
                ${blastRadiusClass}
            `}
            {...commonProps}
        >
            <ValidationBadge />

            <div className="wf_event">
                <div className="wf_event_title">
                    <div className="node-icon-container" style={{ color: nodeType?.color || '#3b82f6' }}>
                        {renderIcon(nodeType?.icon, 18)}
                    </div>
                    <div className="node-title-group">
                        <div className="flex items-center gap-1.5">
                            <span className="node-title-text">{node.title}</span>
                            {node.breakpoint && (
                                <Bug size={12} className="text-red-500 animate-pulse" />
                            )}
                        </div>
                        {nodeType?.subtitle && !((nodeType.subtitle as any)[lang] || '').includes('={{') && (
                            <span className="node-subtitle-text">
                                {(nodeType.subtitle as any)[lang] || (nodeType.subtitle as any).en}
                            </span>
                        )}
                    </div>
                    {heatmapStyle?.stats && (
                        <div className="ml-auto flex items-center gap-2">
                            <div className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] font-mono text-white flex items-center gap-1 border border-white/10">
                                <Zap size={10} className="text-yellow-400" />
                                {heatmapStyle.stats.executionCount}
                            </div>
                        </div>
                    )}
                </div>

                <div className="wf_body">
                    <p className="node-description">
                        {(nodeType?.description as any)?.[lang] || (nodeType?.description as any)?.en || 'No description available'}
                    </p>
                    {heatmapStyle?.stats && (
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                            <span className="flex items-center gap-1">
                                <AlertCircle size={10} className={heatmapStyle.stats.failureCount > 0 ? 'text-red-400' : 'text-gray-500'} />
                                {heatmapStyle.stats.failureCount}
                            </span>
                            <span className="flex items-center gap-1">
                                <ChevronRight size={10} />
                                {Math.round(heatmapStyle.stats.avgDuration)}ms
                            </span>
                        </div>
                    )}
                </div>

                {/* Heatmap Glow Overlay */}
                {heatmapStyle && (
                    <div 
                        className="absolute inset-0 rounded-[inherit] pointer-events-none z-[-1] opacity-40 transition-all duration-500"
                        style={heatmapOverlayStyle}
                    />
                )}

                {/* Ports Container Left */}
                <div className="ports-container ports-container-left">
                    {inputs.map((input: any, idx: number) => (
                        <div
                            key={`in-${idx}`}
                            className="wf_pole_button wf_input_pole"
                            title={input.label || input.name}
                            onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.stopPropagation();
                                e.preventDefault();
                                onSolderStart && onSolderStart(node.id, 'input', e.clientX, e.clientY, idx);
                            }}
                        />
                    ))}
                </div>

                {/* Ports Container Right */}
                <div className="ports-container ports-container-right">
                    {outputs.map((output: any, idx: number) => (
                        <div
                            key={`out-${idx}`}
                            className="wf_pole_button wf_output_pole"
                            title={output.label || output.name}
                            onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.stopPropagation();
                                e.preventDefault();
                                onSolderStart && onSolderStart(node.id, 'output', e.clientX, e.clientY, idx);
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

const EditorNode = memo(EditorNodeComponent);
export default EditorNode;