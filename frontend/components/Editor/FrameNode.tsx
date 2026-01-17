// frontend/components/Editor/FrameNode.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight, Lock, Unlock } from 'lucide-react';
import type { WorkflowNode } from '@nanoflow/shared';

// n8n-style frame colors
const FRAME_COLORS = [
    { id: 'blue', color: '#3b82f6', label: 'Blue' },
    { id: 'green', color: '#22c55e', label: 'Green' },
    { id: 'purple', color: '#8b5cf6', label: 'Purple' },
    { id: 'orange', color: '#f97316', label: 'Orange' },
    { id: 'pink', color: '#ec4899', label: 'Pink' },
    { id: 'teal', color: '#14b8a6', label: 'Teal' },
    { id: 'gray', color: '#6b7280', label: 'Gray' },
] as const;

type FrameColorId = typeof FRAME_COLORS[number]['id'];

interface FrameNodeProps {
    node: WorkflowNode;
    isSelected: boolean;
    onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    onDragStart: (nodeId: string, e: React.MouseEvent) => void;
    zoom?: number;
    containedNodeIds?: string[]; // IDs of nodes contained within this frame
    onSelectContained?: (nodeIds: string[]) => void; // Select all nodes in frame
}

export default function FrameNode({
    node,
    isSelected,
    onUpdate,
    onDragStart,
    zoom = 1,
    containedNodeIds = [],
    onSelectContained,
}: FrameNodeProps) {
    const [title, setTitle] = useState((node.config as any)?.title || 'Frame');
    const [isEditing, setIsEditing] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const resizeRef = useRef<{
        startX: number;
        startY: number;
        startW: number;
        startH: number;
        corner: string;
    } | null>(null);
    const frameRef = useRef<HTMLDivElement>(null);

    // Frame dimensions with defaults
    const width = (node.config as any)?.width || 400;
    const height = (node.config as any)?.height || 300;
    const colorId = ((node.config as any)?.colorId as FrameColorId) || 'blue';
    const colorConfig = FRAME_COLORS.find(c => c.id === colorId) || FRAME_COLORS[0];
    const isCollapsed = (node.config as any)?.collapsed || false;
    const isLocked = (node.config as any)?.locked || false;

    // Collapsed height
    const collapsedHeight = 40;
    const displayHeight = isCollapsed ? collapsedHeight : height;

    // Sync title from config
    useEffect(() => {
        setTitle((node.config as any)?.title || 'Frame');
    }, [(node.config as any)?.title]);

    const handleTitleBlur = () => {
        setIsEditing(false);
        onUpdate(node.id, { config: { ...node.config, title } });
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleTitleBlur();
        }
        if (e.key === 'Escape') {
            setTitle((node.config as any)?.title || 'Frame');
            setIsEditing(false);
        }
    };

    // Resize handlers
    const handleResizeStart = useCallback((e: React.MouseEvent, corner: string) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startW: width,
            startH: height,
            corner,
        };
    }, [width, height]);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!resizeRef.current) return;

            const { startX, startY, startW, startH, corner } = resizeRef.current;
            const deltaX = (e.clientX - startX) / zoom;
            const deltaY = (e.clientY - startY) / zoom;

            let newWidth = startW;
            let newHeight = startH;

            if (corner.includes('e')) newWidth = Math.max(200, startW + deltaX);
            if (corner.includes('w')) newWidth = Math.max(200, startW - deltaX);
            if (corner.includes('s')) newHeight = Math.max(150, startH + deltaY);
            if (corner.includes('n')) newHeight = Math.max(150, startH - deltaY);

            onUpdate(node.id, {
                config: {
                    ...node.config,
                    width: newWidth,
                    height: newHeight
                }
            });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            resizeRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, zoom, node.id, node.config, onUpdate]);

    // Toggle collapse
    const toggleCollapse = () => {
        onUpdate(node.id, { config: { ...node.config, collapsed: !isCollapsed } });
    };

    // Toggle lock
    const toggleLock = () => {
        onUpdate(node.id, { config: { ...node.config, locked: !isLocked } });
    };

    // Change color
    const handleColorChange = (newColorId: FrameColorId) => {
        onUpdate(node.id, { config: { ...node.config, colorId: newColorId } });
        setShowColorPicker(false);
    };

    // Select all contained nodes
    const handleSelectContained = () => {
        if (onSelectContained && containedNodeIds.length > 0) {
            onSelectContained(containedNodeIds);
        }
    };

    return (
        <div
            ref={frameRef}
            id={`d_wfn_${node.id}`}
            className={`wf_node wf_frame ${isSelected ? 'selected' : ''} ${isCollapsed ? 'collapsed' : ''} ${isLocked ? 'locked' : ''}`}
            style={{
                left: node.position.x,
                top: node.position.y,
                width,
                height: displayHeight,
                '--frame-color': colorConfig.color,
            } as React.CSSProperties}
        >
            {/* Title Bar - Draggable */}
            <div
                className="frame-title-bar"
                style={{ borderColor: colorConfig.color }}
                onMouseDown={(e) => {
                    if (isLocked) return;
                    e.stopPropagation();
                    onDragStart(node.id, e);
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                }}
            >
                {/* Collapse Toggle */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
                    className="frame-collapse-btn"
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* Color indicator */}
                <div
                    className="w-3 h-3 rounded-full cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: colorConfig.color }}
                    onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
                    title="Change color"
                />

                {/* Title */}
                {isEditing ? (
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        autoFocus
                        className="frame-title-input"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="frame-title">{title}</span>
                )}

                {/* Node count badge */}
                {containedNodeIds.length > 0 && (
                    <span
                        className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded-full cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: colorConfig.color, color: 'white' }}
                        onClick={(e) => { e.stopPropagation(); handleSelectContained(); }}
                        title="Click to select all nodes in frame"
                    >
                        {containedNodeIds.length}
                    </span>
                )}

                {/* Lock toggle */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleLock(); }}
                    className="frame-lock-btn ml-1"
                    title={isLocked ? 'Unlock' : 'Lock'}
                >
                    {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
            </div>

            {/* Color picker dropdown */}
            {showColorPicker && (
                <div
                    className="absolute top-8 left-2 flex gap-1 p-2 bg-white rounded-lg shadow-lg z-50 border"
                    onClick={(e) => e.stopPropagation()}
                >
                    {FRAME_COLORS.map((color) => (
                        <button
                            key={color.id}
                            onClick={() => handleColorChange(color.id)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                                colorId === color.id ? 'ring-2 ring-offset-1 ring-blue-500' : 'border-white'
                            }`}
                            style={{ backgroundColor: color.color }}
                            title={color.label}
                        />
                    ))}
                </div>
            )}

            {/* Content Area - Hidden when collapsed */}
            {!isCollapsed && <div className="frame-content" />}

            {/* Resize Handles - Hidden when collapsed or locked */}
            {!isCollapsed && !isLocked && (
                <>
                    <div
                        className="frame-resize-handle se"
                        onMouseDown={(e) => handleResizeStart(e, 'se')}
                    />
                    <div
                        className="frame-resize-handle sw"
                        onMouseDown={(e) => handleResizeStart(e, 'sw')}
                    />
                    <div
                        className="frame-resize-handle ne"
                        onMouseDown={(e) => handleResizeStart(e, 'ne')}
                    />
                    <div
                        className="frame-resize-handle nw"
                        onMouseDown={(e) => handleResizeStart(e, 'nw')}
                    />
                    <div
                        className="frame-resize-handle e"
                        onMouseDown={(e) => handleResizeStart(e, 'e')}
                    />
                    <div
                        className="frame-resize-handle w"
                        onMouseDown={(e) => handleResizeStart(e, 'w')}
                    />
                    <div
                        className="frame-resize-handle s"
                        onMouseDown={(e) => handleResizeStart(e, 's')}
                    />
                    <div
                        className="frame-resize-handle n"
                        onMouseDown={(e) => handleResizeStart(e, 'n')}
                    />
                </>
            )}
        </div>
    );
}
