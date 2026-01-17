// frontend/components/Editor/NoteNode.tsx
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { WorkflowNode } from '@nanoflow/shared';

// n8n-style note colors
const NOTE_COLORS = [
    { id: 'yellow', bg: '#fef9c3', border: '#fde047', text: '#713f12' },
    { id: 'green', bg: '#dcfce7', border: '#86efac', text: '#14532d' },
    { id: 'blue', bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a' },
    { id: 'purple', bg: '#f3e8ff', border: '#d8b4fe', text: '#581c87' },
    { id: 'pink', bg: '#fce7f3', border: '#f9a8d4', text: '#831843' },
    { id: 'orange', bg: '#ffedd5', border: '#fdba74', text: '#7c2d12' },
    { id: 'gray', bg: '#f3f4f6', border: '#d1d5db', text: '#374151' },
] as const;

type NoteColorId = typeof NOTE_COLORS[number]['id'];

interface NoteNodeProps {
    node: WorkflowNode;
    isSelected: boolean;
    onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    zoom?: number;
}

// Simple Markdown renderer for notes
function renderMarkdown(text: string): string {
    if (!text) return '';

    return text
        // Headers
        .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold mb-1">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold mb-1">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mb-2">$1</h1>')
        // Bold and italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Code
        .replace(/`(.+?)`/g, '<code class="bg-black/10 px-1 rounded text-[11px]">$1</code>')
        // Lists
        .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
        .replace(/^\* (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
        // Checkboxes
        .replace(/^\[x\] (.+)$/gm, '<div class="flex items-center gap-1"><input type="checkbox" checked disabled class="w-3 h-3"/><span class="line-through opacity-60">$1</span></div>')
        .replace(/^\[ \] (.+)$/gm, '<div class="flex items-center gap-1"><input type="checkbox" disabled class="w-3 h-3"/><span>$1</span></div>')
        // Line breaks
        .replace(/\n/g, '<br/>');
}

export default function NoteNode({ node, isSelected, onUpdate, zoom = 1 }: NoteNodeProps) {
    const [text, setText] = useState(node.config?.text || '');
    const [isEditing, setIsEditing] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
    const noteRef = useRef<HTMLDivElement>(null);

    // Get current color config
    const colorId = ((node.config as any)?.color as NoteColorId) || 'yellow';
    const colorConfig = NOTE_COLORS.find(c => c.id === colorId) || NOTE_COLORS[0];

    // Dimensions
    const width = (node.config as any)?.width || 275;
    const height = (node.config as any)?.height || 200;
    const isWide = (node.config as any)?.wide || false;

    useEffect(() => {
        setText(node.config?.text || '');
    }, [node.config?.text]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value);
    };

    const handleBlur = () => {
        setIsEditing(false);
        onUpdate(node.id, { config: { ...node.config, text } });
    };

    const handleColorChange = (newColorId: NoteColorId) => {
        onUpdate(node.id, { config: { ...node.config, color: newColorId } });
        setShowColorPicker(false);
    };

    const toggleWideMode = () => {
        const newWide = !isWide;
        onUpdate(node.id, {
            config: {
                ...node.config,
                wide: newWide,
                width: newWide ? 550 : 275
            }
        });
    };

    // Resize handlers
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startW: width,
            startH: height,
        };
    }, [width, height]);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!resizeRef.current) return;

            const { startX, startY, startW, startH } = resizeRef.current;
            const deltaX = (e.clientX - startX) / zoom;
            const deltaY = (e.clientY - startY) / zoom;

            const newWidth = Math.max(200, startW + deltaX);
            const newHeight = Math.max(100, startH + deltaY);

            onUpdate(node.id, {
                config: {
                    ...node.config,
                    width: newWidth,
                    height: newHeight,
                    wide: false // Disable wide mode on manual resize
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

    // Rendered markdown content
    const renderedContent = useMemo(() => renderMarkdown(text), [text]);

    return (
        <div
            ref={noteRef}
            id={`d_wfn_${node.id}`}
            className={`wf_node wf_note ${isSelected ? 'selected' : ''} ${isWide ? 'wf_wide' : ''}`}
            style={{
                left: node.position.x,
                top: node.position.y,
                width: isWide ? 550 : width,
                height,
                backgroundColor: colorConfig.bg,
                borderColor: colorConfig.border,
                borderWidth: '2px',
                borderStyle: 'solid',
            }}
            onDoubleClick={() => setIsEditing(true)}
        >
            {/* Toolbar (visible on hover or when selected) */}
            <div
                className="note-toolbar absolute -top-8 left-0 right-0 flex items-center gap-1 px-2 py-1 opacity-0 transition-opacity"
                style={{ opacity: isSelected ? 1 : undefined }}
            >
                {/* Color picker button */}
                <button
                    onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
                    className="w-5 h-5 rounded border-2 border-white shadow-sm hover:scale-110 transition-transform"
                    style={{ backgroundColor: colorConfig.border }}
                    title="Change color"
                />

                {/* Wide mode toggle */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleWideMode(); }}
                    className="px-2 py-0.5 text-[10px] font-medium bg-white/80 rounded shadow-sm hover:bg-white transition-colors"
                    style={{ color: colorConfig.text }}
                    title={isWide ? 'Normal width' : 'Wide mode'}
                >
                    {isWide ? 'Narrow' : 'Wide'}
                </button>
            </div>

            {/* Color picker dropdown */}
            {showColorPicker && (
                <div
                    className="absolute -top-16 left-0 flex gap-1 p-2 bg-white rounded-lg shadow-lg z-50"
                    onClick={(e) => e.stopPropagation()}
                >
                    {NOTE_COLORS.map((color) => (
                        <button
                            key={color.id}
                            onClick={() => handleColorChange(color.id)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                                colorId === color.id ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                            }`}
                            style={{
                                backgroundColor: color.bg,
                                borderColor: color.border
                            }}
                            title={color.id}
                        />
                    ))}
                </div>
            )}

            {/* Content */}
            {isEditing ? (
                <textarea
                    value={text}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    autoFocus
                    placeholder="# Title\n\nWrite your note here...\n\n- List item\n- [ ] Todo item"
                    className="w-full h-full p-3 bg-transparent resize-none focus:outline-none text-xs leading-relaxed"
                    style={{ color: colorConfig.text }}
                />
            ) : (
                <div
                    className="w-full h-full p-3 overflow-auto text-xs leading-relaxed note-content"
                    style={{ color: colorConfig.text }}
                    dangerouslySetInnerHTML={{ __html: renderedContent || '<span class="opacity-50">Double click to edit note...</span>' }}
                />
            )}

            {/* Resize handle */}
            <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
                style={{
                    background: `linear-gradient(135deg, transparent 50%, ${colorConfig.border} 50%)`,
                    opacity: isSelected ? 0.6 : undefined
                }}
                onMouseDown={handleResizeStart}
            />
        </div>
    );
}
