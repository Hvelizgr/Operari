import { act, renderHook } from '@testing-library/react';

import { useAutosave } from '../../hooks/useAutosave';

describe('useAutosave with an inline header object', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ timestamp: 1 }),
      text: async () => '',
    });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
  afterEach(() => jest.useRealTimers());

  it('does not keep saving when nothing changed', async () => {
    const nodes = [{ id: 'n1', type: 'shell', title: 'n1', position: { x: 0, y: 0 } }] as any[];
    renderHook(() =>
      useAutosave({
        nodes,
        connections: [],
        runbookId: 'rb-1',
        debounceMs: 1000,
        runbookHeader: { name: 'rb' },
      })
    );
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    const puts = (global.fetch as jest.Mock).mock.calls.filter(
      ([url, init]) => init?.method === 'PUT' && !String(url).endsWith('/yaml')
    );
    expect(puts.length).toBe(1);
  });
});
