import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import SchedulesPage from '@/components/Schedules/SchedulesPage';

const fetchMock = jest.fn();

const schedule = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 's-1',
  workflow: { id: 'wf-1', slug: 'payments', name: 'Payments runbook' },
  cronExpr: '*/5 * * * *',
  humanCron: 'Every 5 minutes',
  isActive: true,
  lastRunAt: null,
  nextRunAt: '2026-04-24T20:05:00Z',
  lastRun: null,
  createdAt: '2026-04-01T00:00:00Z',
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-04-24T20:01:00Z'));
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/api/schedules') && method === 'GET') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [schedule()] }),
      });
    }
    if (url.includes('/api/runbooks')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ runbooks: [] }) });
    }
    if (url.includes('/run') && method === 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }
    if (url.includes('/api/schedules/') && method === 'DELETE') {
      return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SchedulesPage', () => {
  it('fires an in-app toast after run-now instead of native alert()', async () => {
    const nativeAlert = jest.spyOn(window, 'alert');
    await act(async () => {
      render(<SchedulesPage lang="en" />);
    });
    await waitFor(() => expect(screen.getAllByText('Payments runbook').length).toBeGreaterThan(0));

    // Fire "Run now" on the only row.
    fireEvent.click(screen.getByRole('button', { name: /run now/i }));
    await waitFor(() => expect(screen.getByText(/run triggered/i)).toBeInTheDocument());

    expect(nativeAlert).not.toHaveBeenCalled();
    nativeAlert.mockRestore();
  });

  it('uses inline delete confirm instead of native confirm()', async () => {
    const nativeConfirm = jest.spyOn(window, 'confirm');
    await act(async () => {
      render(<SchedulesPage lang="en" />);
    });
    await waitFor(() => expect(screen.getAllByText('Payments runbook').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /unschedule/i }));
    expect(nativeConfirm).not.toHaveBeenCalled();
    // Two buttons now: confirm-yes (reuses t.delete = "Unschedule")
    // and cancel. The existence of "Cancel" after clicking delete is
    // the tell the inline confirm is active.
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    nativeConfirm.mockRestore();
  });

  it('uses narrow-viewport padding classes (px-4 with sm:px-6)', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({ data: [] }) })
    );
    const { container } = await act(async () => render(<SchedulesPage lang="en" />));
    const root = container.querySelector('.mx-auto.max-w-6xl');
    expect(root?.className).toContain('px-4');
    expect(root?.className).toContain('sm:px-6');
  });
});
