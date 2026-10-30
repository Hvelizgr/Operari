import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AddCredentialForm from '../../components/Settings/AddCredentialForm';

describe('AddCredentialForm', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('stores an OpenAI-compatible provider with its base URL and model', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: { id: 'a1' } }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const onSaved = jest.fn();
    render(<AddCredentialForm lang="en" onSaved={onSaved} />);

    fireEvent.click(screen.getByText('Add AI provider'));
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'groq' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Groq prod' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'gsk_123' } });
    fireEvent.change(screen.getByLabelText('Default model'), {
      target: { value: 'llama-3.3-70b' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/connected-accounts$/);
    expect(JSON.parse(init.body as string)).toEqual({
      provider: 'ai.openai-compatible',
      displayName: 'Groq prod',
      secret: 'gsk_123',
      metadata: {
        preset: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        defaultModel: 'llama-3.3-70b',
      },
    });
  });

  it('shows the server error when saving fails', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'ENCRYPTION_KEY is not configured' }),
    })) as unknown as typeof fetch;
    render(<AddCredentialForm lang="en" onSaved={jest.fn()} />);
    fireEvent.click(screen.getByText('Add credential'));
    fireEvent.change(screen.getByLabelText('Secret'), { target: { value: 'xoxb' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText(/ENCRYPTION_KEY/)).toBeTruthy();
  });
});
