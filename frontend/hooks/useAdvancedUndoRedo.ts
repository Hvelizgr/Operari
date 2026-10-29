import { useCallback, useRef, useState } from 'react';

interface Command {
  execute: () => void;
  undo: () => void;
  description?: string;
}

interface UseAdvancedUndoRedoReturn {
  executeCommand: (command: Command) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
  history: Command[];
  currentIndex: number;
}

export function useAdvancedUndoRedo(maxHistorySize: number = 50): UseAdvancedUndoRedoReturn {
  // Commands run setState on other components, so they must not run
  // inside a state updater (React may call updaters during render, and
  // twice in StrictMode). The ref is the source of truth; the state only
  // triggers re-renders.
  const historyRef = useRef<{ history: Command[]; currentIndex: number }>({
    history: [],
    currentIndex: -1,
  });
  const [state, setState] = useState(historyRef.current);

  const commit = useCallback((next: { history: Command[]; currentIndex: number }) => {
    historyRef.current = next;
    setState(next);
  }, []);

  const executeCommand = useCallback(
    (command: Command) => {
      command.execute();

      const { history, currentIndex } = historyRef.current;
      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(command);

      if (newHistory.length > maxHistorySize) {
        commit({
          history: newHistory.slice(newHistory.length - maxHistorySize),
          currentIndex: maxHistorySize - 1,
        });
        return;
      }
      commit({ history: newHistory, currentIndex: newHistory.length - 1 });
    },
    [maxHistorySize, commit]
  );

  const undo = useCallback(() => {
    const { history, currentIndex } = historyRef.current;
    if (currentIndex < 0) return;
    history[currentIndex].undo();
    commit({ history, currentIndex: currentIndex - 1 });
  }, [commit]);

  const redo = useCallback(() => {
    const { history, currentIndex } = historyRef.current;
    if (currentIndex >= history.length - 1) return;
    const nextIndex = currentIndex + 1;
    history[nextIndex].execute();
    commit({ history, currentIndex: nextIndex });
  }, [commit]);

  const clear = useCallback(() => {
    commit({ history: [], currentIndex: -1 });
  }, [commit]);

  return {
    executeCommand,
    undo,
    redo,
    canUndo: state.currentIndex >= 0,
    canRedo: state.currentIndex < state.history.length - 1,
    clear,
    history: state.history,
    currentIndex: state.currentIndex,
  };
}
