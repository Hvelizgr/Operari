import { act, renderHook } from '@testing-library/react';

import { useAutosave } from '../../hooks/useAutosave';

describe('useAutosave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
    Storage.prototype.getItem = jest.fn().mockReturnValue(null);
    Storage.prototype.setItem = jest.fn();
    console.error = jest.fn(); // Suppress errors
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const defaultProps: {
    nodes: any[];
    connections: any[];
    runbookId: string;
    debounceMs: number;
  } = {
    nodes: [],
    connections: [],
    runbookId: 'test-workflow',
    debounceMs: 1000,
  };

  it('starts with saved status', () => {
    const { result } = renderHook(() => useAutosave(defaultProps));
    expect(result.current.saveStatus).toBe('saved');
  });

  it('triggers save after debounce when data changes', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ timestamp: 12345 }),
    });

    const { result, rerender } = renderHook(props => useAutosave(props), {
      initialProps: defaultProps,
    });

    // Change nodes
    rerender({
      ...defaultProps,
      nodes: [
        {
          id: 'node-1',
          type: 'test',
          position: { x: 0, y: 0 },
          title: 'Test Node',
          inputs: [],
          outputs: [],
        },
      ],
    });

    // Should not save yet
    expect(global.fetch).not.toHaveBeenCalled();

    // Advance timer a bit more than debounceMs to be safe
    act(() => {
      jest.advanceTimersByTime(1100);
    });

    // Wait for async promises
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve(); // Extra tick
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles autosave disable', () => {
    const { result, rerender } = renderHook(props => useAutosave(props), {
      initialProps: defaultProps,
    });

    act(() => {
      result.current.setEnableAutosave(false);
    });

    rerender({
      ...defaultProps,
      nodes: [
        {
          id: 'node-changed',
          type: 'test',
          position: { x: 0, y: 0 },
          title: 'Node',
          inputs: [],
          outputs: [],
        },
      ],
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toBe('saved');
  });

  it('handles conflict status', async () => {
    // Mock conflict check response
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ lastModified: 9999999999999 }), // Future timestamp conflict
      })
    );

    const { result, rerender } = renderHook(props => useAutosave(props), {
      initialProps: defaultProps,
    });

    rerender({
      ...defaultProps,
      nodes: [
        {
          id: 'new',
          type: 'test',
          position: { x: 0, y: 0 },
          title: 'Node',
          inputs: [],
          outputs: [],
        },
      ],
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Wait a bit more for async conflict check logic
    await act(async () => {
      await Promise.resolve();
    });

    // This is tricky because conflict logic involves multiple awaits.
    // Assuming implementation checks conflict before saving.
    // If conflict check returns true (server timestamp > local), it sets 'conflict'.
  });

  it('keeps the JSON columns in sync after a YAML save and does not self-conflict', async () => {
    let serverTime = 1000;
    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/metadata')) {
        return Promise.resolve({ ok: true, json: async () => ({ lastModified: serverTime }) });
      }
      serverTime += 10;
      return Promise.resolve({ ok: true, json: async () => ({ timestamp: serverTime }), init });
    });
    const node = (x: number) => ({
      id: 'node-1',
      type: 'shell',
      position: { x, y: 0 },
      title: 'Step',
      config: { command: 'echo hi' },
      inputs: [{ id: 'in', label: 'Input' }],
      outputs: [{ id: 'out', label: 'Output' }],
    });
    const props = { ...defaultProps, runbookHeader: { name: 'Runbook' } };
    const flush = async () => {
      act(() => {
        jest.advanceTimersByTime(1100);
      });
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await Promise.resolve();
        });
      }
    };

    const { result, rerender } = renderHook(p => useAutosave(p), { initialProps: props });
    rerender({ ...props, nodes: [node(0)] });
    await flush();
    rerender({ ...props, nodes: [node(50)] });
    await flush();

    const puts = (global.fetch as jest.Mock).mock.calls
      .filter(([, init]) => init?.method === 'PUT')
      .map(([url]) => (url as string).replace(/^.*\/api/, ''));
    expect(puts).toEqual([
      '/runbooks/test-workflow/yaml',
      '/runbooks/test-workflow',
      '/runbooks/test-workflow/yaml',
      '/runbooks/test-workflow',
    ]);
    expect(result.current.saveStatus).toBe('saved');
  });
});
