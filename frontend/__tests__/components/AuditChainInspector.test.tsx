import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AuditChainInspector } from '@/components/Settings/AuditChainInspector';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  jest.clearAllMocks();
});

describe('AuditChainInspector', () => {
  it('renders nothing for non-admin viewers', () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { container } = render(<AuditChainInspector lang="en" viewerRole="USER" />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists recent audit events on mount for admins', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'e1',
            seq: '1',
            type: 'run.started',
            actorId: null,
            actorType: null,
            resource: 'rb-1',
            payload: { foo: 'bar' },
            hash: 'abcdef0123456789'.repeat(4),
            prevHash: '',
            createdAt: '2026-04-29T12:00:00.000Z',
          },
          {
            id: 'e2',
            seq: '2',
            type: 'run.completed',
            actorId: 'u1',
            actorType: 'user',
            resource: 'rb-1',
            payload: {},
            hash: 'fedcba9876543210'.repeat(4),
            prevHash: 'abcdef0123456789'.repeat(4),
            createdAt: '2026-04-29T12:01:00.000Z',
          },
        ],
        nextSeq: null,
      }),
    })) as unknown as typeof fetch;

    render(<AuditChainInspector lang="en" viewerRole="ADMIN" />);

    expect(await screen.findByText('run.started')).toBeInTheDocument();
    expect(screen.getByText('run.completed')).toBeInTheDocument();
    expect(screen.getByText('user:u1')).toBeInTheDocument();
  });

  it('shows the empty state when the API returns no events', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [], nextSeq: null }),
    })) as unknown as typeof fetch;

    render(<AuditChainInspector lang="en" viewerRole="ADMIN" />);
    expect(await screen.findByText(/no audit events yet/i)).toBeInTheDocument();
  });

  it('runs verify on click and shows the intact badge', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('/audit/verify')) {
        return {
          ok: true,
          json: async () => ({
            tenantId: 't1',
            eventCount: 100,
            intact: true,
            firstBrokenSeq: null,
            firstGapAfterSeq: null,
            verifiedAt: '2026-04-29T12:00:00.000Z',
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({ data: [], nextSeq: null }),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<AuditChainInspector lang="en" viewerRole="ADMIN" />);
    fireEvent.click(await screen.findByRole('button', { name: /verify chain/i }));

    expect(await screen.findByText(/chain intact/i)).toBeInTheDocument();
    expect(screen.getByText(/Total events: 100/i)).toBeInTheDocument();
  });

  it('shows the broken badge with the first broken seq', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('/audit/verify')) {
        return {
          ok: true,
          json: async () => ({
            tenantId: 't1',
            eventCount: 50,
            intact: false,
            firstBrokenSeq: '17',
            firstGapAfterSeq: null,
            verifiedAt: '2026-04-29T12:00:00.000Z',
          }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({ data: [], nextSeq: null }) } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<AuditChainInspector lang="en" viewerRole="ADMIN" />);
    fireEvent.click(await screen.findByRole('button', { name: /verify chain/i }));

    expect(await screen.findByText(/chain broken/i)).toBeInTheDocument();
    expect(screen.getByText(/first divergence at seq 17/i)).toBeInTheDocument();
  });

  it('paginates forward when nextSeq is present', async () => {
    let call = 0;
    const fetchMock = jest.fn(async () => {
      call += 1;
      if (call === 1) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'e1',
                seq: '1',
                type: 'run.started',
                actorId: null,
                actorType: null,
                resource: null,
                payload: {},
                hash: 'h1'.padEnd(64, 'x'),
                prevHash: '',
                createdAt: '2026-04-29T12:00:00.000Z',
              },
            ],
            nextSeq: '26',
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'e26',
              seq: '26',
              type: 'run.completed',
              actorId: 'u2',
              actorType: 'user',
              resource: null,
              payload: {},
              hash: 'h2'.padEnd(64, 'x'),
              prevHash: 'h1'.padEnd(64, 'x'),
              createdAt: '2026-04-29T13:00:00.000Z',
            },
          ],
          nextSeq: null,
        }),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<AuditChainInspector lang="en" viewerRole="ADMIN" />);

    expect(await screen.findByText('run.started')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByText('run.completed')).toBeInTheDocument());

    const calls = fetchMock.mock.calls as unknown[][];
    const secondCallUrl = String(calls[1][0]);
    expect(secondCallUrl).toContain('fromSeq=26');
  });
});
