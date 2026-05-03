import { render, screen } from '@testing-library/react';

import { SpanTimeline } from '@/components/Editor/SpanTimeline';

describe('SpanTimeline', () => {
  it('renders the no-run hint when startedAt is null', () => {
    render(<SpanTimeline startedAt={null} durationMs={null} lang="en" />);
    expect(screen.getByText(/no run yet/i)).toBeInTheDocument();
  });

  it('renders the Running… label when there is a startedAt but no duration', () => {
    render(<SpanTimeline startedAt={new Date().toISOString()} durationMs={null} lang="en" />);
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });

  it('renders the Finished label and duration when terminal', () => {
    const start = Date.now() - 2400;
    render(<SpanTimeline startedAt={start} durationMs={2400} lang="en" />);
    expect(screen.getByText(/finished/i)).toBeInTheDocument();
    expect(screen.getByText(/2\.4s/)).toBeInTheDocument();
  });

  it('formats sub-second durations in ms', () => {
    render(<SpanTimeline startedAt={Date.now() - 240} durationMs={240} lang="en" />);
    expect(screen.getByText(/240ms/)).toBeInTheDocument();
  });

  it('formats >60s durations in m s', () => {
    render(<SpanTimeline startedAt={Date.now() - 85_000} durationMs={85_000} lang="en" />);
    expect(screen.getByText(/1m 25s/)).toBeInTheDocument();
  });
});
