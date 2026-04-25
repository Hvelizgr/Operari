import { act, render } from '@testing-library/react';

import FirstRunConfetti from '@/components/Editor/FirstRunConfetti';

// anime.js runs a real animation loop. For this test we care about
// the gating logic (does it fire the DOM insertion once?), not the
// visual burst — stub anime to a no-op that still calls the complete
// callback so cleanup runs.
jest.mock('animejs', () => {
  const fn = jest.fn((opts: { complete?: () => void }) => {
    opts.complete?.();
  });
  // @ts-expect-error — matching the default export shape animejs uses
  fn.random = (min: number, max: number) => (min + max) / 2;
  return { __esModule: true, default: fn };
});

describe('FirstRunConfetti', () => {
  beforeEach(() => {
    window.localStorage.clear();
    const anime = jest.requireMock('animejs').default as jest.Mock;
    anime.mockClear();
  });

  it('does nothing on initial render when runCompleted starts as true (no edge)', () => {
    const anime = jest.requireMock('animejs').default as jest.Mock;
    render(<FirstRunConfetti runCompleted={true} />);
    expect(anime).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('nanorun:sawFirstRunConfetti')).toBeNull();
  });

  it('fires on false→true transition and sets the seen flag', () => {
    const anime = jest.requireMock('animejs').default as jest.Mock;
    const { rerender } = render(<FirstRunConfetti runCompleted={false} />);
    expect(anime).not.toHaveBeenCalled();

    act(() => {
      rerender(<FirstRunConfetti runCompleted={true} />);
    });
    expect(anime).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('nanorun:sawFirstRunConfetti')).toBe('1');
  });

  it('skips the burst when the seen flag is already set (idempotent across sessions)', () => {
    window.localStorage.setItem('nanorun:sawFirstRunConfetti', '1');
    const anime = jest.requireMock('animejs').default as jest.Mock;

    const { rerender } = render(<FirstRunConfetti runCompleted={false} />);
    rerender(<FirstRunConfetti runCompleted={true} />);
    expect(anime).not.toHaveBeenCalled();
  });

  it('never fires twice within the same mount', () => {
    const anime = jest.requireMock('animejs').default as jest.Mock;
    const { rerender } = render(<FirstRunConfetti runCompleted={false} />);
    act(() => rerender(<FirstRunConfetti runCompleted={true} />));
    // Simulate a second completion (without the parent clearing the
    // flag between runs — the component's own ref guard must catch).
    act(() => rerender(<FirstRunConfetti runCompleted={false} />));
    act(() => rerender(<FirstRunConfetti runCompleted={true} />));
    expect(anime).toHaveBeenCalledTimes(1);
  });
});
