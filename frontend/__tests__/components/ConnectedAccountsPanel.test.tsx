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
    const deleteCall = (fetchMock.mock.calls as unknown[][]).find(
      call => (call[1] as RequestInit | undefined)?.method === 'DELETE'
    );
    expect(deleteCall).toBeUndefined();
  });

  it('renders the current env tag and PATCHes the new value when the operator edits it', async () => {
    let envOnServer: string | null = 'staging';
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { env: string | null };
        envOnServer = body.env;
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'ca-1',
              provider: 'github',
              displayName: 'alice',
              scopes: ['repo'],
              createdAt: '2026-04-29T00:00:00Z',
              env: envOnServer,
            },
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'ca-1',
              provider: 'github',
              displayName: 'alice',
              scopes: ['repo'],
              createdAt: '2026-04-29T00:00:00Z',
              env: envOnServer,
            },
          ],
        }),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    installLocation();

    render(<ConnectedAccountsPanel lang="en" />);

    // Initial render shows the staging tag inside the env button.
    const stagingChip = await screen.findByTitle(/set environment/i);
    expect(stagingChip).toHaveTextContent('staging');

    fireEvent.click(stagingChip);
    const input = await screen.findByLabelText(/environment/i);
    fireEvent.change(input, { target: { value: 'prod' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        call => (call[1] as RequestInit | undefined)?.method === 'PATCH'
      );
      expect(patchCall).toBeTruthy();
      expect(JSON.parse(String((patchCall![1] as RequestInit).body))).toEqual({ env: 'prod' });
    });

    // Refresh shows the new tag.
    await waitFor(() => {
      const updated = screen.getByTitle(/set environment/i);
      expect(updated).toHaveTextContent('prod');
    });
  });

  it('rejects an env value with disallowed characters before sending the PATCH', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'ca-1',
            provider: 'github',
            displayName: 'alice',
            scopes: ['repo'],
            createdAt: '2026-04-29T00:00:00Z',
            env: null,
          },
        ],
      }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    installLocation();

    render(<ConnectedAccountsPanel lang="en" />);
    const editBtn = await screen.findByTitle(/set environment/i);
    fireEvent.click(editBtn);
    const input = await screen.findByLabelText(/environment/i);
    fireEvent.change(input, { target: { value: 'has spaces' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/a-z, 0-9/i)).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find(call => call[1]?.method === 'PATCH');
    expect(patchCall).toBeUndefined();
  });

  it('runs the connection test and renders a success line on a working token', async () => {
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && String(url).endsWith('/test')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            provider: 'github',
            info: { login: 'alice', scopes: ['repo'] },
          }),
        } as unknown as Response;
      }
      // Initial list call.
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'ca-9',
              provider: 'github',
              displayName: 'alice',
              scopes: ['repo'],
              createdAt: 't',
              env: null,
            },
          ],
        }),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    installLocation();

    render(<ConnectedAccountsPanel lang="en" />);
    const testBtn = await screen.findByRole('button', { name: /^test$/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      const testCall = fetchMock.mock.calls.find(call => String(call[0]).endsWith('/test'));
      expect(testCall).toBeTruthy();
    });
    expect(await screen.findByText(/token works/i)).toBeInTheDocument();
    expect(screen.getByText(/@alice/)).toBeInTheDocument();
  });

  it('renders an error line when the test fails', async () => {
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && String(url).endsWith('/test')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: false,
            provider: 'github',
            status: 401,
            message: 'Bad credentials',
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'ca-9',
              provider: 'github',
              displayName: 'alice',
              scopes: ['repo'],
              createdAt: 't',
              env: null,
            },
          ],
        }),
      } as unknown as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    installLocation();

    render(<ConnectedAccountsPanel lang="en" />);
    fireEvent.click(await screen.findByRole('button', { name: /^test$/i }));
    expect(await screen.findByText(/token rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/bad credentials/i)).toBeInTheDocument();
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
