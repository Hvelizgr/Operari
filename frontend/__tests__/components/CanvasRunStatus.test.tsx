import { render, screen } from '@testing-library/react';

import CanvasRunStatus from '@/components/Editor/CanvasRunStatus';

describe('CanvasRunStatus', () => {
  it('renders nothing when not executing', () => {
    const { container } = render(
      <CanvasRunStatus executing={false} hasFailedNode={false} startedAt={null} lang="en" />
    );
    // Null return = empty div from the testing-library wrapper.
    expect(container.firstChild).toBeNull();
  });

  it('shows "Running" with a spinner and no elapsed when startedAt is null', () => {
    render(<CanvasRunStatus executing hasFailedNode={false} startedAt={null} lang="en" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    // No elapsed segment rendered when the start time is unknown.
    expect(screen.queryByText(/0:/)).not.toBeInTheDocument();
  });

  it('renders formatted elapsed time when startedAt is provided', () => {
    // Freeze Date.now so the elapsed read is deterministic.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(125_000);
    render(<CanvasRunStatus executing hasFailedNode={false} startedAt={5_000} lang="en" />);
    // 125_000 - 5_000 = 120_000 ms = 2:00
    expect(screen.getByText(/· 2:00/)).toBeInTheDocument();
    nowSpy.mockRestore();
  });

  it('switches to failure styling and appends "step failed"', () => {
    render(<CanvasRunStatus executing hasFailedNode startedAt={null} lang="en" />);
    // Failure label surfaces alongside the Running text.
    expect(screen.getByText(/step failed/)).toBeInTheDocument();
  });

  it('localises copy in Spanish', () => {
    render(<CanvasRunStatus executing hasFailedNode startedAt={null} lang="es" />);
    expect(screen.getByText('Ejecutando')).toBeInTheDocument();
    expect(screen.getByText(/paso falló/)).toBeInTheDocument();
  });
});
