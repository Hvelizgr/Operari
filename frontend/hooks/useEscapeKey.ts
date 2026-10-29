import { useEffect, useRef } from 'react';

/** Calls `onEscape` when Escape is pressed while `active` is true.
 *  Full-screen modal backdrops swallow every click, so without this a
 *  keyboard user had no way out short of finding the close button. */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  // Callers pass inline closures; a ref keeps the listener from being
  // re-attached on every render.
  const handler = useRef(onEscape);
  handler.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler.current();
    };
    // Capture phase so a focused input inside the modal cannot swallow it.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active]);
}
