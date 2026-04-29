import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ConnectedAccountsPanel from '@/components/Settings/ConnectedAccountsPanel';

const realFetch = globalThis.fetch;
const realConfirm = globalThis.confirm;
const realLocation = window.location;

// jsdom does not implement window.location.assign, but the panel calls it
// after the OAuth start endpoint returns the GitHub authorize URL. Mock
// the whole location so we can assert the navigation target.
function installLocation() {
  const fakeLocation = {
    href: 'http://localhost/en/settings',
    pathname: '/en/settings',
    search: '',
    assign: jest.fn(),
  };
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: fakeLocation,
    writable: true,
  });
  return fakeLocation;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.confirm = realConfirm;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: realLocation,
    writable: true,
  });
  jest.clearAllMocks();
});

describe('ConnectedAccountsPanel', () => {
  it('lists existing accounts returned by GET /api/connected-accounts', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'ca-1',
            provider: 'github',
            displayName: 'alice (github)',
            scopes: ['repo'],
            createdAt: '2026-04-29T00:00:00Z',
          },
        ],
      }),
    })) as unknown as typeof fetch;
    installLocation();

    render(<ConnectedAccountsPanel lang="en" />);
    expect(await screen.findByText('alice (github)')).toBeInTheDocument();
  });

  it('shows the empty-state copy when the API returns no accounts', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })) as unknown as typeof fetch;
    installLocation();

    render(<ConnectedAccountsPanel lang="en" />);
    expect(await screen.findByText(/no accounts linked/i)).toBeInTheDocument();
  });

  it('calls /github/oauth/start and redirects on Connect GitHub', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('/oauth/start')) {
        return {
          ok: true,
          json: async () => ({ url: 'https://github.com/login/oauth/authorize?client_id=x' }),
        } as unknown as Response;
      }
      // Initial list call.
      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const fakeLoc = installLocation();

    render(<ConnectedAccountsPanel lang="en" />);
    fireEvent.click(await screen.findByRole('button', { name: /connect github/i }));

    await waitFor(() => {
      expect(fakeLoc.assign).toHaveBeenCalledWith(
        'https://github.com/login/oauth/authorize?client_id=x'
      );
    });
  });

  it('calls DELETE on disconnect after user confirmation', async () => {
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return { ok: true, status: 204 } as unknown as Response;
      }
      // Two list calls: initial + post-delete refresh.
      return {
        ok: true,
        json: async () => ({
          data:
            fetchMock.mock.calls.length <= 1
              ? [
                  {
                    id: 'ca-9',
                    provider: 'github',
                    displayName: 'bob',
                    scopes: ['repo'],
                    createdAt: 't',
                  },
                ]
              : [],
        }),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.confirm = jest.fn(() => true) as unknown as typeof confirm;
    installLocation();

    render(<ConnectedAccountsPanel lang="en" />);
    const disconnect = await screen.findByRole('button', { name: /^disconnect$/i });
    fireEvent.click(disconnect);

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        call => (call[1] as RequestInit)?.method === 'DELETE'
      );
      expect(deleteCall).toBeTruthy();
      expect(String(deleteCall![0])).toContain('/api/connected-accounts/ca-9');
    });
  });

  it('does not call DELETE when the user cancels the confirm dialog', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'ca-9',
            provider: 'github',
            displayName: 'bob',
            scopes: ['repo'],
            createdAt: 't',
          },
        ],
      }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.confirm = jest.fn(() => false) as unknown as typeof confirm;
    installLocation();

    render(<ConnectedAccountsPanel lang="en" />);
    fireEvent.click(await screen.findByRole('button', { name: /^disconnect$/i }));

    // give the click handler a tick to NOT issue a DELETE
    await new Promise(r => setTimeout(r, 10));
    const deleteCall = fetchMock.mock.calls.find(
      call => (call[1] as RequestInit)?.method === 'DELETE'
    );
    expect(deleteCall).toBeUndefined();
  });

  it('strips ?ca_linked from the URL after showing the success flash', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })) as unknown as typeof fetch;
    const fakeLoc = installLocation();
    fakeLoc.search = '?ca_linked=github';
    const replaceState = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});

    render(<ConnectedAccountsPanel lang="en" />);
    expect(await screen.findByText(/github account linked/i)).toBeInTheDocument();

    expect(replaceState).toHaveBeenCalled();
    const lastCallUrl = String(replaceState.mock.calls[replaceState.mock.calls.length - 1][2]);
    expect(lastCallUrl).not.toContain('ca_linked');
    replaceState.mockRestore();
  });
});
