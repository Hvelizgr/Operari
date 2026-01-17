'use client';

import { MouseEvent, useRef, useLayoutEffect, memo } from 'react';
import { NodeType, NODE_TYPES } from '../Node';
import { WorkflowNode } from '@nanoflow/shared';
import './WorkflowNode.css';
import { Box, AlertCircle, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
// Import shared port utilities
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
    onSolderStart?: (nodeId: string, port: 'input' | 'output', initialX?: number, initialY?: number) => void;
    onNodeDoubleClick?: (nodeId: string) => void;
    onUpdate?: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    isConnected?: boolean;
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
    onPortDragStart
}: EditorNodeProps) {
    const nodeRef = useRef<HTMLDivElement>(null);
    const nodeType = typeDefinition || NODE_TYPES.find(t => t.type === node.type);

    // Measure Height
    useLayoutEffect(() => {
        if (!nodeRef.current || !onUpdate) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { height } = entry.contentRect;
                // Avoid infinite loops by checking threshold
                const currentHeight = (node as any).dimensions?.height;
                if (!currentHeight || Math.abs(currentHeight - height) > 2) {
                    // Adding 4px for border/padding discrepancies if contentRect is smaller than offsetHeight
                    // Actually contentRect is what we want if we center in content. 
                    // But offsetHeight includes borders. 
                    // Let's use bounding client rect for full visual height.
                    const rect = entry.target.getBoundingClientRect();
                    // Zoom affects this? No, we want logical pixels.
                    // The observer gives pixels.
                    // IMPORTANT: If zoom is applied on parent, observer results might be scaled.
                    // But EditorNode is inside a transform. 
                    // We need unscaled height?
                    // Actually, if we use offsetHeight from the element, it is the layout height.
                    const element = entry.target as HTMLElement;
                    const finalHeight = element.offsetHeight;

                    if (!currentHeight || Math.abs(currentHeight - finalHeight) > 2) {
                        onUpdate(node.id, { dimensions: { height: finalHeight, width: element.offsetWidth } } as any);
                    }
                }
            }
        });

        resizeObserver.observe(nodeRef.current);
        return () => resizeObserver.disconnect();
    }, [node.id, onUpdate, (node as any).dimensions?.height]);

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
    let visualType = 'job';
    if (type.includes('trigger') || type === 'start') visualType = 'trigger';
    else if (type.includes('controller') || type === 'condition') visualType = 'controller';
    else if (type.includes('limit')) visualType = 'limit';
    else if (type.includes('action') || type.includes('email') || type.includes('slack') || type.includes('discord')) visualType = 'action';

    // Validation Badge
    // Notes are handled in parent, triggers/starts don't always need inputs but should have outputs.
    // If we only check "is connected to ANYTHING", then independent triggers show error?
    // User requested: "Si un nodo requiere conexión". Triggers require output connection generally? Or is just fine alone?
    // Usually a workflow needs flow. A trigger alone does nothing.
    // The prop `isConnected` comes from `connections.some(...)`.
    // So if a trigger has NO connections, it is isolated.
    const showValidation = !isConnected;

    // Don't show validation limits/controllers if logic implies optional? 
    // Actually, let's stick to "Is it connected to anything?".
    // We already moved Notes to separate component in NodesLayer, so no need to check here if logic was moved effectively.
    // But `visualType` check might be safe.

    const ValidationBadge = () => (
        showValidation && (
            <div
                className="absolute -top-2 -right-2 z-50 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center border border-white shadow-sm animate-pulse pointer-events-none"
                title="Disconnected Node"
            >
                <AlertCircle size={12} className="text-white" />
            </div>
        )
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

    // --- CONTROLLER (Pill) ---
    if (visualType === 'controller') {
        return (
            <div
                ref={nodeRef}
                className={`wf_node wf_entity ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''}`}
                {...commonProps}
            >
                <ValidationBadge />
                <div className="wf_ent_controller">
                    {/* Input Pole (Purple) */}
                    <div
                        className="wf_pole_button wf_input_pole"
                        role="button"
                        aria-label={`Connect input for ${node.title}`}
                        tabIndex={0}
                        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'input', e.clientX, e.clientY); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSolderStart && onSolderStart(node.id, 'input'); } }}
                    >
                        <ChevronRight size={12} />
                    </div>

                    <span className="flex items-center justify-center h-full w-full relative">
                        {renderIcon(nodeType?.icon, 32)}
                    </span>

                    {/* Output Pole (Purple) */}
                    <div
                        className="wf_pole_button wf_output_pole"
                        role="button"
                        aria-label={`Connect output for ${node.title}`}
                        tabIndex={0}
                        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output', e.clientX, e.clientY); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output'); } }}
                    >
                        <ChevronRight size={12} />
                    </div>
                </div>
                <span className="wf_ent_title">{nodeType?.category || 'Controller'}</span>
                <span className="wf_ent_label">{node.title}</span>
            </div>
        );
    }

    // --- LIMIT (Diamond) ---
    if (visualType === 'limit') {
        return (
            <div
                className={`wf_node wf_entity ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''}`}
                {...commonProps}
            >
                <ValidationBadge />
                <div className="wf_ent_limit">
                    {/* Up Pole (Input) - Handled by CSS rotation magic but we need structure */}
                    <div
                        className="wf_pole_button wf_up_pole"
                        title="Input (Limit)"
                        role="button"
                        aria-label={`Connect input for ${node.title}`}
                        tabIndex={0}
                        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'input', e.clientX, e.clientY); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSolderStart && onSolderStart(node.id, 'input'); } }}
                    >
                        <ChevronDown size={12} style={{ transform: 'rotate(225deg)' }} /> {/* Counter rotate? CSS handles some */}
                    </div>

                    <span className="flex items-center justify-center h-full w-full relative" style={{ transform: 'rotate(-45deg)' }}>
                        {renderIcon(nodeType?.icon, 32)}
                    </span>

                    {/* Down Pole (Output) - Implicitly handled or we add it? CSS says .wf_down_pole */}
                    {/* For Limit, typically Output is NOT on the diamond tip in xyOps CSS, it's usually handled by .wf_down_pole relative to container? 
                        Let's check CSS... Ah, wf_ent_limit > .wf_up_pole is styled. 
                        Usually limits sit in the flow. Let's add standard poles but styled. 
                        Actually, looking at CSS, .wf_ent_limit transforms rotate(45deg). 
                        Inside it, content needs -45deg.
                    */}
                </div>
                {/* For Limit, output is often just flow through or specific logic. We'll add a Down pole at bottom center of containing div if needed, 
                    but sticking to strict CSS interpretation: Limit usually has UP pole (input). 
                    Let's assume standard Output pole (Down) is attached to container.
                    Wait, CSS .wf_pole_button.wf_down_pole is defined generally.
                */}
                <div
                    className="wf_pole_button wf_down_pole"
                    style={{ left: '50%', top: 'calc(100% + 5px)' }}
                    role="button"
                    aria-label={`Connect output for ${node.title}`}
                    tabIndex={0}
                    onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output', e.clientX, e.clientY); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output'); } }}
                >
                    <ChevronDown size={12} />
                </div>

                <span className="wf_ent_title">{nodeType?.category || 'Limit'}</span>
                <span className="wf_ent_label">{node.title}</span>
            </div>
        );
    }

    // --- TRIGGER ---
    if (visualType === 'trigger') {
        return (
            <div
                className={`wf_node wf_entity ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''}`}
                {...commonProps}
            >
                <ValidationBadge />
                <div className="wf_ent_trigger">
                    <span className="flex items-center justify-center h-full w-full relative" style={{ left: '-6px' }}>
                        {renderIcon(nodeType?.icon, 32)}
                    </span>
                    <div
                        className="wf_pole_button wf_output_pole"
                        role="button"
                        aria-label={`Connect output for ${node.title}`}
                        tabIndex={0}
                        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output', e.clientX, e.clientY); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output'); } }}
                    >
                        <ChevronRight size={12} />
                    </div>
                </div>
                <span className="wf_ent_title">{nodeType?.category || 'Trigger'}</span>
                <span className="wf_ent_label">{node.title}</span>
            </div>
        );
    }

    // --- ACTION (Semicircle) ---
    if (visualType === 'action') {
        return (
            <div
                className={`wf_node wf_entity ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${status === 'RUNNING' ? 'wf_active' : ''}`}
                {...commonProps}
            >
                <ValidationBadge />
                <div className="wf_ent_action">
                    <div
                        className="wf_pole_button wf_input_pole"
                        role="button"
                        aria-label={`Connect input for ${node.title}`}
                        tabIndex={0}
                        onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'input', e.clientX, e.clientY); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSolderStart && onSolderStart(node.id, 'input'); } }}
                    >
                        <ChevronRight size={12} />
                    </div>
                    <span className="flex items-center justify-center h-full w-full relative" style={{ left: '6px' }}>
                        {renderIcon(nodeType?.icon, 32)}
                    </span>
                </div>
                <span className="wf_ent_title">{nodeType?.category || 'Action'}</span>
                <span className="wf_ent_label">{node.title}</span>
            </div>
        );
    }

    // --- JOB (Standard) ---
    return (
        <div
            className={`
                wf_node wf_event 
                ${isSelected ? 'selected' : ''}
                ${isDragging ? 'dragging' : ''}
                ${status === 'RUNNING' ? 'wf_active' : ''}
                ${status === 'SUCCESS' ? 'wf_completed' : ''}
                ${status === 'FAILED' ? 'wf_error' : ''}
            `}
            ref={nodeRef}
            {...commonProps}
        >
            <ValidationBadge />
            <div className="wf_event_title">
                <span className="mr-1 opacity-50"><GripVertical size={16} /></span>
                <span className="mr-2 inline-flex items-center">{renderIcon(nodeType?.icon, 16)}</span>
                {node.title}
            </div>

            <div className="wf_body">
                <div className="summary_grid double">
                    <div>
                        <div className="info_label">Category</div>
                        <div className="info_value">{nodeType?.category || 'General'}</div>
                    </div>
                    <div>
                        <div className="info_label">Type</div>
                        <div className="info_value capitalize">{node.type.replace('_', ' ')}</div>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <div className="info_label">Description</div>
                        <div className="info_value truncate">{nodeType?.description?.en || ''}</div>
                    </div>
                </div>
            </div>

            <div
                className="wf_pole_button wf_input_pole"
                role="button"
                aria-label={`Connect input for ${node.title}`}
                tabIndex={0}
                onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'input', e.clientX, e.clientY); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSolderStart && onSolderStart(node.id, 'input'); } }}
            >
                <ChevronRight size={12} />
            </div>
            <div
                className="wf_pole_button wf_output_pole"
                role="button"
                aria-label={`Connect output for ${node.title}`}
                tabIndex={0}
                onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output', e.clientX, e.clientY); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSolderStart && onSolderStart(node.id, 'output'); } }}
            >
                <ChevronRight size={12} />
            </div>
        </div>
    );
}

const EditorNode = memo(EditorNodeComponent);
export default EditorNode;
