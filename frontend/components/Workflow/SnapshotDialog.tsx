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
  lang,
}: SnapshotDialogProps) {
  const text = {
    en: {
      title: 'Version History (Local)',
      create: 'Create Snapshot',
      restore: 'Restore',
      delete: 'Delete',
      empty: 'No snapshots found.',
      created: 'Created',
      nodes: 'nodes',
    },
    es: {
      title: 'Historial de Versiones (Local)',
      create: 'Crear Versión',
      restore: 'Restaurar',
      delete: 'Eliminar',
      empty: 'No hay versiones guardadas.',
      created: 'Creado',
      nodes: 'nodos',
    },
  }[lang];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="dialog border-[var(--highlight-color)]/30 border shadow-[0px_0px_50px_rgba(0,0,0,0.8)]"
            style={
              {
                width: '500px',
                maxHeight: '80vh',
                background: 'var(--box-background-color)',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              } as any
            }
            onClick={e => e.stopPropagation()}
          >
            {/* Title Bar */}
            <div
              className="dialog_title"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
                borderBottom: '1px solid var(--border-color)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '15px',
                fontWeight: 'bold',
                color: 'var(--highlight-color)',
                letterSpacing: '0.05em',
              }}
            >
              <div className="flex items-center gap-2">
                <History size={16} />
                {text.title}
              </div>
              <button className="opacity-50 transition-opacity hover:opacity-100" onClick={onClose}>
                <X size={16} />
              </button>
            </div>

            {/* Toolbar */}
            <div className="border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.02)] p-4">
              <button
                onClick={onCreate}
                className="bg-primary hover:bg-primary flex w-full items-center justify-center gap-2 rounded px-4 py-2 font-medium text-white transition-colors"
              >
                <Camera size={16} />
                {text.create}
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {snapshots.length === 0 ? (
                <div className="py-8 text-center italic text-gray-500">{text.empty}</div>
              ) : (
                <div className="space-y-2">
                  {snapshots.map(snap => (
                    <div
                      key={snap.id}
                      className="group flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[rgba(255,255,255,0.03)] p-3 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-200">{snap.name}</span>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span>{new Date(snap.timestamp).toLocaleString()}</span>
                          <span className="h-1 w-1 rounded-full bg-gray-600" />
                          <span>
                            {snap.nodes.length} {text.nodes}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => onRestore(snap.id)}
                          className="tooltip rounded p-2 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
                          title={text.restore}
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(snap.id)}
                          className="tooltip rounded p-2 text-red-500 hover:bg-red-500/10 hover:text-red-400"
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
