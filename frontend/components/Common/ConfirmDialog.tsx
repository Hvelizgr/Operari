'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
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

/**
 * Wrapped on Radix `Dialog` so we get focus trap, ESC handling, and
 * outside-click dismissal for free. The previous framer-motion build
 * had to reimplement those by hand and missed several (e.g. focus
 * never returned to the trigger after dismissal). Open/close fade is
 * driven by Radix's `data-state` attribute → tailwind utilities.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={open => !open && onCancel()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 mx-4 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="text-red-500" size={20} />
            </div>

            <div className="flex-1">
              <DialogPrimitive.Title className="mb-2 text-lg font-semibold text-slate-100">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-slate-300">
                {message}
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg bg-slate-700 px-4 py-2 font-medium text-slate-200 transition-colors hover:bg-slate-600"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-500"
            >
              {confirmLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
