
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { History, X, RotateCcw, Trash2, Camera } from 'lucide-react';
import { Snapshot } from '../../hooks/useSnapshots';

interface SnapshotDialogProps {
    isOpen: boolean;
    onClose: () => void;
    snapshots: Snapshot[];
    onRestore: (snapshotId: string) => void;
    onDelete: (snapshotId: string) => void;
    onCreate: () => void;
    lang: 'en' | 'es';
}

export default function SnapshotDialog({
    isOpen,
    onClose,
    snapshots,
    onRestore,
    onDelete,
    onCreate,
    lang
}: SnapshotDialogProps) {

    const text = {
        en: {
            title: 'Version History (Local)',
            create: 'Create Snapshot',
            restore: 'Restore',
            delete: 'Delete',
            empty: 'No snapshots found.',
            created: 'Created',
            nodes: 'nodes'
        },
        es: {
            title: 'Historial de Versiones (Local)',
            create: 'Crear Versión',
            restore: 'Restaurar',
            delete: 'Eliminar',
            empty: 'No hay versiones guardadas.',
            created: 'Creado',
            nodes: 'nodos'
        }
    }[lang];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px]" onClick={onClose}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="dialog shadow-[0px_0px_50px_rgba(0,0,0,0.8)] border border-[var(--highlight-color)]/30"
                        style={{
                            width: '500px',
                            maxHeight: '80vh',
                            background: 'var(--box-background-color)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        } as any}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Title Bar */}
                        <div
                            className="dialog_title"
                            style={{
                                background: 'linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
                                borderBottom: '1px solid var(--border-color)',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '15px',
                                fontWeight: 'bold',
                                color: 'var(--highlight-color)',
                                letterSpacing: '0.05em'
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <History size={16} />
                                {text.title}
                            </div>
                            <button className="opacity-50 hover:opacity-100 transition-opacity" onClick={onClose}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Toolbar */}
                        <div className="p-4 border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.02)]">
                            <button
                                onClick={onCreate}
                                className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <Camera size={16} />
                                {text.create}
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {snapshots.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 italic">
                                    {text.empty}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {snapshots.map((snap) => (
                                        <div
                                            key={snap.id}
                                            className="group bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[var(--border-color)] rounded-lg p-3 transition-colors flex items-center justify-between"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-200">{snap.name}</span>
                                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                    <span>{new Date(snap.timestamp).toLocaleString()}</span>
                                                    <span className="w-1 h-1 bg-gray-600 rounded-full" />
                                                    <span>{snap.nodes.length} {text.nodes}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => onRestore(snap.id)}
                                                    className="p-2 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded tooltip"
                                                    title={text.restore}
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(snap.id)}
                                                    className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded tooltip"
                                                    title={text.delete}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
