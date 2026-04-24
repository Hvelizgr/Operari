import { act, render, screen, waitFor } from '@testing-library/react';

import { DashboardToasts } from '@/components/Common/DashboardToasts';

/**
 * DashboardToasts watches the current URL for `?verified=true`
 * (set by the backend's email-verify redirect) and surfaces a
 * transient toast. Tests: the url -> toast wire, param-stripping,
 * no-fire on clean urls, and Spanish copy.
 */

function setUrl(pathAndSearch: string) {
  window.history.replaceState({}, '', pathAndSearch);
}

describe('DashboardToasts', () => {
  beforeEach(() => {
    setUrl('/dashboard');
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when the URL has no verified param', () => {
    setUrl('/dashboard');
    const { container } = render(<DashboardToasts lang="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the EN success message when ?verified=true is present', () => {
    setUrl('/dashboard?verified=true');
    render(<DashboardToasts lang="en" />);
    expect(screen.getByText('Email verified — thanks for confirming.')).toBeInTheDocument();
  });

  it('shows the ES success message when lang=es', () => {
    setUrl('/dashboard?verified=true');
    render(<DashboardToasts lang="es" />);
    expect(screen.getByText('Email verificado — gracias por confirmar.')).toBeInTheDocument();
  });

  it('strips the verified param after showing so a reload does not re-fire', () => {
    setUrl('/dashboard?verified=true&other=keep');
    render(<DashboardToasts lang="en" />);
    // Mounted with the query param; effect should have stripped
    // `verified` while preserving the rest.
    expect(window.location.search).toBe('?other=keep');
  });

  it('uses a bare path when verified was the only query param', () => {
    setUrl('/dashboard?verified=true');
    render(<DashboardToasts lang="en" />);
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('auto-dismisses after the toast duration elapses', async () => {
    setUrl('/dashboard?verified=true');
    render(<DashboardToasts lang="en" />);
    expect(screen.getByText(/Email verified/)).toBeInTheDocument();

    // Toast sleeps 3s then kicks off a 200ms fade-out before unmount.
    await act(async () => {
      jest.advanceTimersByTime(3000 + 200);
    });

    await waitFor(() => expect(screen.queryByText(/Email verified/)).toBeNull());
  });

  it('ignores ?verified=false (only `true` triggers)', () => {
    setUrl('/dashboard?verified=false');
    const { container } = render(<DashboardToasts lang="en" />);
    expect(container).toBeEmptyDOMElement();
    // Param is not stripped on the falsey path.
    expect(window.location.search).toBe('?verified=false');
  });
});
