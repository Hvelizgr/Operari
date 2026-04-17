'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Trash2, ToggleRight, Play, Plus, ZoomIn, ZoomOut, Maximize2, Undo2, Redo2, History, Keyboard, Link2Off, Move, Pencil, Eraser } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onToggleEnable?: () => void;
    onTestFromNode?: () => void;
    lang: 'en' | 'es';
    type: 'node' | 'canvas';
    // Canvas actions
    onAddNode?: () => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onFitView?: () => void;
    // Additional actions
    onUndo?: () => void;
    onRedo?: () => void;
    onHistory?: () => void;
    onShortcuts?: () => void;
    onDetachConnections?: () => void;
    onSetModeMove?: () => void;
    onSetModeDraw?: () => void;
    onClearAll?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

export default function ContextMenu({
    x, y, onClose, onDuplicate, onDelete, onToggleEnable, onTestFromNode, lang, type,
    onAddNode, onZoomIn, onZoomOut, onFitView,
    onUndo, onRedo, onHistory, onShortcuts, onDetachConnections, onSetModeMove, onSetModeDraw, onClearAll,
    canUndo = true, canRedo = true
}: ContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x, y });

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        const maxX = window.innerWidth - 200;
        const maxY = window.innerHeight - 300;
        setPosition({
            x: Math.min(x, maxX),
            y: Math.min(y, maxY),
        });
    }, [x, y]);

    const content = {
        en: {
            duplicate: 'Duplicate',
            toggleEnable: 'Enable/Disable',
            delete: 'Delete',
            testFromNode: 'Test From Here',
            addNode: 'Add Node',
            zoomIn: 'Zoom In',
            zoomOut: 'Zoom Out',
            fitView: 'Fit View',
            undo: 'Undo',
            redo: 'Redo',
            history: 'History',
            shortcuts: 'Shortcuts',
            detach: 'Detach Connections',
            modeMove: 'Move Mode',
            modeDraw: 'Draw Mode',
            clearAll: 'Clear All',
        },
        es: {
            duplicate: 'Duplicar',
            toggleEnable: 'Activar/Desactivar',
            delete: 'Eliminar',
            testFromNode: 'Probar Desde Aquí',
            addNode: 'Agregar Nodo',
            zoomIn: 'Acercar',
            zoomOut: 'Alejar',
            fitView: 'Ajustar Vista',
            undo: 'Deshacer',
            redo: 'Rehacer',
            history: 'Historial',
            shortcuts: 'Atajos',
            detach: 'Desconectar',
            modeMove: 'Modo Mover',
            modeDraw: 'Modo Dibujar',
            clearAll: 'Limpiar Todo',
        },
    };

    const text = content[lang] || content['en'];

    const nodeMenuItems = [
        { icon: Play, label: text.testFromNode, action: onTestFromNode, color: 'text-green-400' },
        { icon: Copy, label: text.duplicate, action: onDuplicate, color: 'text-slate-300' },
        { icon: ToggleRight, label: text.toggleEnable, action: onToggleEnable, color: 'text-slate-300' },
        { icon: Link2Off, label: text.detach, action: onDetachConnections, color: 'text-primary/70' },
        { icon: Trash2, label: text.delete, action: onDelete, color: 'text-red-400' },
    ];

    const canvasMenuItems = [
        { icon: Plus, label: text.addNode, action: onAddNode, color: 'text-primary/70' },
        { icon: Undo2, label: text.undo, action: onUndo, color: 'text-slate-300', disabled: !canUndo },
        { icon: Redo2, label: text.redo, action: onRedo, color: 'text-slate-300', disabled: !canRedo },
        { icon: Move, label: text.modeMove, action: onSetModeMove, color: 'text-slate-300' },
        { icon: Pencil, label: text.modeDraw, action: onSetModeDraw, color: 'text-slate-300' },
        { icon: History, label: text.history, action: onHistory, color: 'text-primary/70' },
        { icon: Keyboard, label: text.shortcuts, action: onShortcuts, color: 'text-slate-300' },
        { icon: ZoomIn, label: text.zoomIn, action: onZoomIn, color: 'text-slate-300' },
        { icon: ZoomOut, label: text.zoomOut, action: onZoomOut, color: 'text-slate-300' },
        { icon: Maximize2, label: text.fitView, action: onFitView, color: 'text-slate-300' },
        { icon: Eraser, label: text.clearAll, action: onClearAll, color: 'text-red-400' },
    ];

    const items = type === 'node' ? nodeMenuItems : canvasMenuItems;

    return (
        <AnimatePresence>
            <motion.div
                ref={ref}
                className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden min-w-[180px]"
                style={{ left: position.x, top: position.y }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                onClick={(e) => e.stopPropagation()}
            >
                {items.map((item, index) => (
                    item.action && (
                        <button
                            key={index}
                            onClick={() => {
                                if ((item as any).disabled) return;
                                item.action?.();
                                onClose();
                            }}
                            disabled={(item as any).disabled}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 transition-colors text-left ${(item as any).disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            <item.icon size={16} className={item.color} />
                            <span className="text-sm text-slate-200">{item.label}</span>
                        </button>
                    )
                ))}
            </motion.div>
        </AnimatePresence>
    );
}
