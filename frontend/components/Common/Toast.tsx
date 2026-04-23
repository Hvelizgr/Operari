'use client';

import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Thin toast wrapper. Not trying to be react-hot-toast — just enough
 * to show a transient success message without a third-party dep.
 * Auto-dismisses after `durationMs` (default 3s) and is also
 * manually dismissable.
 */
export function Toast({
  message,
  durationMs = 3000,
  onClose,
  variant = 'success',
}: {
  message: string;
  durationMs?: number;
  onClose: () => void;
  variant?: 'success' | 'info';
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => {
      setVisible(false);
      // Give the fade-out animation a beat before unmount.
      setTimeout(onClose, 200);
    }, durationMs);
    return () => clearTimeout(id);
  }, [durationMs, onClose]);

  const tone =
    variant === 'success'
      ? 'border-primary/40 bg-primary/15 text-primary'
      : 'border-sky-500/40 bg-sky-500/15 text-sky-200';

  return (
    <div
      className={`fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2.5 shadow-xl transition-opacity duration-200 ${tone} ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="status"
    >
      <Check className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 200);
        }}
        aria-label="Dismiss"
        className="opacity-70 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
