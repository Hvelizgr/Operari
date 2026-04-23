import { useCallback, useState } from 'react';

/**
 * Small boolean toggle state for the editor's two top-level dialogs:
 * Run-with-inputs and Keyboard Shortcuts Guide. Neither one needs
 * context from the canvas state, so they live in their own hook to
 * keep `useEditorCanvas` focused on drag/select/pan arbitration.
 *
 * If a third dialog shows up, consider generalizing to a
 * `useDialogRegistry({ run, shortcuts, ...})` instead of growing the
 * signature in-place.
 */
export function useEditorDialogs() {
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);
  const [isShortcutsGuideOpen, setIsShortcutsGuideOpen] = useState(false);

  const handleOpenRunDialog = useCallback(() => setIsRunDialogOpen(true), []);
  const handleCloseRunDialog = useCallback(() => setIsRunDialogOpen(false), []);
  const handleOpenShortcutsGuide = useCallback(() => setIsShortcutsGuideOpen(true), []);
  const handleCloseShortcutsGuide = useCallback(() => setIsShortcutsGuideOpen(false), []);

  return {
    isRunDialogOpen,
    isShortcutsGuideOpen,
    handleOpenRunDialog,
    handleCloseRunDialog,
    handleOpenShortcutsGuide,
    handleCloseShortcutsGuide,
  };
}
