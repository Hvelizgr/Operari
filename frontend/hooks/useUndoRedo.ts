import { useState, useCallback, useRef } from 'react';

export interface HistoryState<T> {
    state: T;
    timestamp: number;
}

export function useUndoRedo<T>(initialState: T, maxHistory: number = 50) {
    const [present, setPresent] = useState<T>(initialState);
    const [past, setPast] = useState<HistoryState<T>[]>([]);
    const [future, setFuture] = useState<HistoryState<T>[]>([]);
    const isUndoRedoAction = useRef(false);

    const set = useCallback((newState: T | ((prev: T) => T)) => {
        if (isUndoRedoAction.current) {
            isUndoRedoAction.current = false;
            return;
        }

        const nextState = typeof newState === 'function'
            ? (newState as (prev: T) => T)(present)
            : newState;

        setPast((prev) => [
            ...prev.slice(-maxHistory + 1),
            { state: present, timestamp: Date.now() },
        ]);
        setPresent(nextState);
        setFuture([]);
    }, [present, maxHistory]);

    const undo = useCallback(() => {
        if (past.length === 0) return;

        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);

        isUndoRedoAction.current = true;
        setPast(newPast);
        setFuture([{ state: present, timestamp: Date.now() }, ...future]);
        setPresent(previous.state);
    }, [past, present, future]);

    const redo = useCallback(() => {
        if (future.length === 0) return;

        const next = future[0];
        const newFuture = future.slice(1);

        isUndoRedoAction.current = true;
        setPast([...past, { state: present, timestamp: Date.now() }]);
        setFuture(newFuture);
        setPresent(next.state);
    }, [past, present, future]);

    const clear = useCallback(() => {
        setPast([]);
        setFuture([]);
    }, []);

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    return {
        state: present,
        set,
        undo,
        redo,
        clear,
        canUndo,
        canRedo,
    };
}
