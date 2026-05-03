import { act, render, screen } from '@testing-library/react';

import { LiveCountdown, formatRemaining } from '@/components/Editor/LiveCountdown';

describe('formatRemaining', () => {
  it('zero or negative renders 0s', () => {
    expect(formatRemaining(0)).toBe('0s');
    expect(formatRemaining(-100)).toBe('0s');
  });
  it('sub-second renders ms', () => {
    expect(formatRemaining(450)).toBe('450ms');
  });
  it('sub-minute renders Xs', () => {
    expect(formatRemaining(45_000)).toBe('45s');
  });
  it('sub-hour renders Xm or Xm Ys', () => {
    expect(formatRemaining(120_000)).toBe('2m');
    expect(formatRemaining(85_000)).toBe('1m 25s');
  });
  it('above-hour renders Xh or Xh Ym', () => {
    expect(formatRemaining(3_600_000)).toBe('1h');
    expect(formatRemaining(3_900_000)).toBe('1h 5m');
  });
});

describe('LiveCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-03T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the remaining time for a future endTime', () => {
    render(<LiveCountdown endTime={Date.now() + 90_000} />);
    expect(screen.getByText('1m 30s')).toBeInTheDocument();
  });

  it('renders the expiredText immediately when endTime is past', () => {
    render(<LiveCountdown endTime={Date.now() - 1000} expiredText="auto-rejected" />);
    expect(screen.getByText('auto-rejected')).toBeInTheDocument();
  });

  it('ticks the rendered time forward as wall-clock advances', () => {
    render(<LiveCountdown endTime={Date.now() + 5000} updateInterval={100} />);
    expect(screen.getByText('5s')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('3s')).toBeInTheDocument();
  });

  it('switches to expiredText when the timer elapses', () => {
    render(<LiveCountdown endTime={Date.now() + 1000} updateInterval={100} expiredText="done" />);
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('honours the prefix flag', () => {
    render(<LiveCountdown endTime={Date.now() + 30_000} prefix />);
    expect(screen.getByText(/in 30s/)).toBeInTheDocument();
  });
});
