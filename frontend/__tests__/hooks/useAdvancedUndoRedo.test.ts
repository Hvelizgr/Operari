import { act, renderHook } from '@testing-library/react';

import { useAdvancedUndoRedo } from '@/hooks/useAdvancedUndoRedo';

describe('useAdvancedUndoRedo', () => {
  it('initializes with empty history', () => {
    const { result } = renderHook(() => useAdvancedUndoRedo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('executes command and enables undo', () => {
    const { result } = renderHook(() => useAdvancedUndoRedo());
    const execute = jest.fn();
    const undo = jest.fn();

    act(() => {
      result.current.executeCommand({ execute, undo });
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undoes command correctly', () => {
    const { result } = renderHook(() => useAdvancedUndoRedo());
    const execute = jest.fn();
    const undo = jest.fn();

    act(() => {
      result.current.executeCommand({ execute, undo });
    });

    act(() => {
      result.current.undo();
    });

    expect(undo).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redoes command correctly', () => {
    const { result } = renderHook(() => useAdvancedUndoRedo());
    const execute = jest.fn();
    const undo = jest.fn();

    act(() => {
      result.current.executeCommand({ execute, undo });
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('clears history correctly', () => {
    const { result } = renderHook(() => useAdvancedUndoRedo());

    act(() => {
      result.current.executeCommand({ execute: jest.fn(), undo: jest.fn() });
      result.current.executeCommand({ execute: jest.fn(), undo: jest.fn() });
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('respects max history size', () => {
    const { result } = renderHook(() => useAdvancedUndoRedo(3));

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.executeCommand({ execute: jest.fn(), undo: jest.fn() });
      }
    });

    let undoCount = 0;
    while (result.current.canUndo) {
      act(() => {
        result.current.undo();
      });
      undoCount++;
    }

    expect(undoCount).toBeLessThanOrEqual(3);
  });

  it('truncates redo stack on new command', () => {
    const { result } = renderHook(() => useAdvancedUndoRedo());

    act(() => {
      result.current.executeCommand({ execute: jest.fn(), undo: jest.fn() });
      result.current.executeCommand({ execute: jest.fn(), undo: jest.fn() });
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.executeCommand({ execute: jest.fn(), undo: jest.fn() });
    });

    expect(result.current.canRedo).toBe(false);
  });
});
