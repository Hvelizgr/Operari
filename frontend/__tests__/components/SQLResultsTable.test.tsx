import { fireEvent, render, screen } from '@testing-library/react';

import SQLResultsTable from '@/components/SQLEditor/SQLResultsTable';

describe('SQLResultsTable', () => {
  it('renders a retry button wired to onRetry when an error is shown', () => {
    const onRetry = jest.fn();
    render(
      <SQLResultsTable
        result={null}
        error={{ error: 'syntax error at or near "SELEC"', durationMs: 3 }}
        isLoading={false}
        lang="en"
        onRetry={onRetry}
      />
    );
    const retry = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when onRetry is not provided (read-only usage)', () => {
    render(<SQLResultsTable result={null} error={{ error: 'boom' }} isLoading={false} lang="en" />);
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    // The error body still renders regardless.
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });

  it('renders the spanish retry label when lang=es', () => {
    render(
      <SQLResultsTable
        result={null}
        error={{ error: 'err' }}
        isLoading={false}
        lang="es"
        onRetry={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
