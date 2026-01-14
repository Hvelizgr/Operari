'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Trash2, Edit, Play } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    type: 'node' | 'canvas';
    nodeId?: string;
    onClose: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onExecute?: () => void;
    onAddNode?: () => void;
    lang: 'en' | 'es';
}

export default function ContextMenu({
    x,
    y,
    type,
    onClose,
    onDelete,
    onDuplicate,
    onExecute,
    onAddNode,
    lang,
}: ContextMenuProps) {
    const [position, setPosition] = useState({ x, y });

    useEffect(() => {
        const handleClickOutside = () => onClose();
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
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
            execute: 'Execute Node',
            duplicate: 'Duplicate',
            delete: 'Delete',
            edit: 'Edit',
            addNode: 'Add Node',
        },
        es: {
            execute: 'Ejecutar Nodo',
            duplicate: 'Duplicar',
            delete: 'Eliminar',
            edit: 'Editar',
            addNode: 'Agregar Nodo',
        },
    };

    const text = content[lang] || content['en'];

    const nodeMenuItems = [
        { icon: Play, label: text.execute, action: onExecute, color: 'text-blue-400' },
        { icon: Copy, label: text.duplicate, action: onDuplicate, color: 'text-slate-300' },
        { icon: Trash2, label: text.delete, action: onDelete, color: 'text-red-400' },
    ];

    const canvasMenuItems = [
        { icon: Edit, label: text.addNode, action: onAddNode, color: 'text-blue-400' },
    ];

    const items = type === 'node' ? nodeMenuItems : canvasMenuItems;

    return (
        <AnimatePresence>
            <motion.div
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
                                item.action?.();
                                onClose();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 transition-colors text-left"
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
