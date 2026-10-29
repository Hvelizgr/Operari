import { fireEvent, renderHook } from '@testing-library/react';

import { useEscapeKey } from '../../hooks/useEscapeKey';

describe('useEscapeKey', () => {
  it('calls the handler on Escape only while active', () => {
    const onEscape = jest.fn();
    const { rerender } = renderHook(({ active }) => useEscapeKey(active, onEscape), {
      initialProps: { active: true },
    });

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('uses the latest handler without re-subscribing', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ fn }) => useEscapeKey(true, fn), {
      initialProps: { fn: first },
    });

    rerender({ fn: second });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
