'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

        <motion.div
          className="relative mx-4 w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="text-red-500" size={20} />
            </div>

            <div className="flex-1">
              <h3 className="mb-2 text-lg font-semibold text-slate-100">{title}</h3>
              <p className="text-sm text-slate-300">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded-lg bg-slate-700 px-4 py-2 font-medium text-slate-200 transition-colors hover:bg-slate-600"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-500"
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
