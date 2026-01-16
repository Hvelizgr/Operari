'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Trash2, ToggleRight, Play } from 'lucide-react';
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
}

export default function ContextMenu({ x, y, onClose, onDuplicate, onDelete, onToggleEnable, onTestFromNode, lang, type }: ContextMenuProps) {
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
        },
        es: {
            duplicate: 'Duplicar',
            toggleEnable: 'Activar/Desactivar',
            delete: 'Eliminar',
            testFromNode: 'Probar Desde Aquí',
        },
    };

    const text = content[lang] || content['en'];

    const nodeMenuItems = [
        { icon: Play, label: text.testFromNode, action: onTestFromNode, color: 'text-green-400' },
        { icon: Copy, label: text.duplicate, action: onDuplicate, color: 'text-slate-300' },
        { icon: ToggleRight, label: text.toggleEnable, action: onToggleEnable, color: 'text-slate-300' },
        { icon: Trash2, label: text.delete, action: onDelete, color: 'text-red-400' },
    ];

    const items = type === 'node' ? nodeMenuItems : [];

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
