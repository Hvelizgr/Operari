import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode, StrictMode } from 'react';

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

  it('runs undo and redo exactly once each under StrictMode', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);
    const { result } = renderHook(() => useAdvancedUndoRedo(), { wrapper });
    const command = { execute: jest.fn(), undo: jest.fn() };

    act(() => result.current.executeCommand(command));
    act(() => result.current.undo());
    act(() => result.current.redo());

    expect(command.execute).toHaveBeenCalledTimes(2);
    expect(command.undo).toHaveBeenCalledTimes(1);
  });

  it('undoes two commands when undo is called twice in the same tick', () => {
    const { result } = renderHook(() => useAdvancedUndoRedo());
    const first = { execute: jest.fn(), undo: jest.fn() };
    const second = { execute: jest.fn(), undo: jest.fn() };

    act(() => result.current.executeCommand(first));
    act(() => result.current.executeCommand(second));
    act(() => {
      result.current.undo();
      result.current.undo();
    });

    expect(second.undo).toHaveBeenCalledTimes(1);
    expect(first.undo).toHaveBeenCalledTimes(1);
    expect(result.current.canUndo).toBe(false);
  });
});
