// Module-scoped side channel for palette → canvas drag-drop.
//
// The existing V1 NodePalette callback signature does not pass the
// underlying DragEvent, so we cannot use HTMLDataTransfer to carry the
// dragged step type. Browsers serialize drag events sequentially — only
// one drag is in flight at a time — so a module-scoped ref is safe.

let pendingType: string | null = null;

export const dragChannel = {
  set(type: string): void {
    pendingType = type;
  },
  consume(): string | null {
    const value = pendingType;
    pendingType = null;
    return value;
  },
  peek(): string | null {
    return pendingType;
  },
};
