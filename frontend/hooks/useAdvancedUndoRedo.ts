import { useState, useCallback } from 'react';

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
  const [state, setState] = useState<{ history: Command[]; currentIndex: number }>({
    history: [],
    currentIndex: -1,
  });

  const executeCommand = useCallback(
    (command: Command) => {
      command.execute();

      setState(prev => {
        const { history, currentIndex } = prev;
        const newHistory = history.slice(0, currentIndex + 1);
        newHistory.push(command);

        if (newHistory.length > maxHistorySize) {
          return {
            history: newHistory.slice(newHistory.length - maxHistorySize),
            currentIndex: maxHistorySize - 1,
          };
        }
        return {
          history: newHistory,
          currentIndex: newHistory.length - 1,
        };
      });
    },
    [maxHistorySize]
  );

  const undo = useCallback(() => {
    setState(prev => {
      const { history, currentIndex } = prev;
      if (currentIndex >= 0) {
        history[currentIndex].undo();
        return {
          ...prev,
          currentIndex: currentIndex - 1,
        };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setState(prev => {
      const { history, currentIndex } = prev;
      if (currentIndex < history.length - 1) {
        const nextIndex = currentIndex + 1;
        history[nextIndex].execute();
        return {
          ...prev,
          currentIndex: nextIndex,
        };
      }
      return prev;
    });
  }, []);

  const clear = useCallback(() => {
    setState({
      history: [],
      currentIndex: -1,
    });
  }, []);

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
