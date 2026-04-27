import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

import MonitorsPage from '@/components/Monitors/MonitorsPage';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const fetchMock = jest.fn();

const monitor = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'm-1',
  name: 'Payments 5xx',
  description: null,
  workflowId: 'wf-1',
  checkType: 'failure_rate_above',
  checkConfig: { windowMinutes: 30, threshold: 0.1 },
  isEnabled: true,
  status: 'FIRING',
  lastCheckAt: '2026-04-24T20:00:00Z',
  lastFiredAt: '2026-04-24T19:55:00Z',
  lastReason: null,
  workflow: { id: 'wf-1', slug: 'payments', name: 'Payments runbook' },
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00Z'));
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

/** Feed the initial loads in order: monitors list, runbooks list.
 *  Every caller of MonitorsPage fires both in parallel on mount, so
 *  tests must prime both or waitFor races on the empty-state render. */
const primeLoad = (monitors: unknown[], runbooks: unknown[] = []) => {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/api/monitors') && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: monitors }),
      });
    }
    if (url.includes('/api/runbooks')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ runbooks }),
      });
    }
    if (url.includes('/api/monitors/') && method === 'DELETE') {
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
};

describe('MonitorsPage', () => {
  it('links the runbook name to its own page (not a dead text)', async () => {
    primeLoad([monitor()]);
    await act(async () => {
      render(<MonitorsPage lang="en" />);
    });
    expect(await screen.findByText('Payments runbook')).toBeInTheDocument();

    const link = screen.getByText('Payments runbook').closest('a');
    expect(link).toHaveAttribute('href', '/en/runbooks/payments');
  });

  it('shows inline delete confirm instead of native confirm() dialog', async () => {
    primeLoad([monitor()]);
    await act(async () => {
      render(<MonitorsPage lang="en" />);
    });
    expect(await screen.findByText('Payments 5xx')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /delete/i });

    // Native confirm would surface as a JSDOM dialog trap; prove the
    // component doesn't call it by spying.
    const nativeConfirm = jest.spyOn(window, 'confirm');

    fireEvent.click(deleteBtn);
    expect(nativeConfirm).not.toHaveBeenCalled();

    // The inline confirm UI appears with a yes/cancel pair.
    expect(screen.getByText(/delete this monitor/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    nativeConfirm.mockRestore();
  });

  it('dismisses the confirm state without calling DELETE when cancel is clicked', async () => {
    primeLoad([monitor()]);
    await act(async () => {
      render(<MonitorsPage lang="en" />);
    });
    expect(await screen.findByText('Payments 5xx')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Confirm chip gone — back to the default row actions.
    expect(screen.queryByRole('button', { name: /yes, delete/i })).not.toBeInTheDocument();

    // No DELETE fired.
    const deleteCalls = fetchMock.mock.calls.filter(
      c => (c[1] as { method?: string } | undefined)?.method === 'DELETE'
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it('fires DELETE when the user confirms', async () => {
    primeLoad([monitor()]);
    await act(async () => {
      render(<MonitorsPage lang="en" />);
    });
    expect(await screen.findByText('Payments 5xx')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        c => (c[1] as { method?: string } | undefined)?.method === 'DELETE'
      );
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0][0]).toContain('/api/monitors/m-1');
    });
  });

  it('uses narrow-viewport padding classes (px-4 with sm:px-6)', async () => {
    primeLoad([]);
    const { container } = await act(async () => render(<MonitorsPage lang="en" />));
    const root = container.querySelector('.mx-auto.max-w-6xl');
    expect(root?.className).toContain('px-4');
    expect(root?.className).toContain('sm:px-6');
  });

  it('surfaces inline validation errors on submit of an empty form', async () => {
    primeLoad([], [{ id: 'wf-1', slug: 'payments', name: 'Payments' }]);
    await act(async () => {
      render(<MonitorsPage lang="en" />);
    });
    // Open the form modal via the "New monitor" button.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /new monitor/i }));
    });
    // Wait for modal to mount (form's Save button appears inside it).
    expect(await screen.findByRole('button', { name: /^save$/i })).toBeInTheDocument();
    // Submit the form directly (fireEvent.click on the button is
    // unreliable for jsdom + React submit wiring — `fireEvent.submit`
    // on the <form> dispatches the synthetic event React listens to).
    // Every required field should flash an error. POST must never fire.
    const before = fetchMock.mock.calls.length;
    const form = screen.getByRole('button', { name: /^save$/i }).closest('form') as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/pick a runbook/i)).toBeInTheDocument();
    // No new fetch call — validation short-circuited the submit.
    const postCalls = fetchMock.mock.calls
      .slice(before)
      .filter(c => (c[1] as { method?: string } | undefined)?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });
});
