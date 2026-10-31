import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ConvertToStepButton from '@/components/HttpTester/ConvertToStepButton';
import RequestForm, { type RequestPayload } from '@/components/HttpTester/RequestForm';
import ResponseViewer from '@/components/HttpTester/ResponseViewer';
import PendingHttpStepBanner from '@/components/Editor/PendingHttpStepBanner';

const PENDING_KEY = 'operari:pendingHttpStep';

const basePayload: RequestPayload = {
  method: 'GET',
  url: 'https://example.com/api',
  headers: [],
  body: '',
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('ConvertToStepButton', () => {
  it('writes a pending step to localStorage with the current request', () => {
    render(
      <ConvertToStepButton
        payload={{
          ...basePayload,
          method: 'POST',
          url: 'https://api.example.com/users',
          headers: [{ key: 'Authorization', value: 'Bearer abc' }],
          body: '{"name":"alice"}',
        }}
        lang="en"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /to runbook/i }));
    const stored = window.localStorage.getItem(PENDING_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.type).toBe('operari.httpRequest');
    expect(parsed.config.method).toBe('POST');
    expect(parsed.config.url).toBe('https://api.example.com/users');
    expect(parsed.config.headers).toEqual({ Authorization: 'Bearer abc' });
    expect(parsed.config.body).toBe('{"name":"alice"}');
    expect(typeof parsed.createdAt).toBe('number');
  });

  it('omits body for GET/HEAD even when one was typed', () => {
    render(
      <ConvertToStepButton
        payload={{ ...basePayload, method: 'GET', body: 'should-be-stripped' }}
        lang="en"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /to runbook/i }));
    const parsed = JSON.parse(window.localStorage.getItem(PENDING_KEY)!);
    expect(parsed.config.body).toBeUndefined();
  });

  it('does nothing when disabled', () => {
    render(<ConvertToStepButton payload={basePayload} lang="en" disabled />);
    const btn = screen.getByRole('button', { name: /to runbook/i });
    fireEvent.click(btn);
    expect(window.localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('renders the spanish label', () => {
    render(<ConvertToStepButton payload={basePayload} lang="es" />);
    expect(screen.getByRole('button', { name: /a runbook/i })).toBeInTheDocument();
  });
});

describe('RequestForm', () => {
  it('updates the URL when the user types in the URL input', () => {
    const onChange = jest.fn();
    render(<RequestForm payload={basePayload} onChange={onChange} lang="en" />);
    const input = screen.getByPlaceholderText(/api\.example\.com/i);
    fireEvent.change(input, { target: { value: 'https://new.example.com' } });
    expect(onChange).toHaveBeenCalledWith({ ...basePayload, url: 'https://new.example.com' });
  });

  it('appends a new header row when the user clicks "Add header"', () => {
    const onChange = jest.fn();
    render(<RequestForm payload={basePayload} onChange={onChange} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: /add header/i }));
    expect(onChange).toHaveBeenCalledWith({
      ...basePayload,
      headers: [{ key: '', value: '' }],
    });
  });

  it('disables the body textarea when method is GET', () => {
    render(<RequestForm payload={basePayload} onChange={() => {}} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: /^body/i }));
    const textarea = screen.getByPlaceholderText(/request body/i);
    expect(textarea).toBeDisabled();
  });

  it('enables the body textarea when method is POST', () => {
    render(
      <RequestForm payload={{ ...basePayload, method: 'POST' }} onChange={() => {}} lang="en" />
    );
    fireEvent.click(screen.getByRole('button', { name: /^body/i }));
    const textarea = screen.getByPlaceholderText(/request body/i);
    expect(textarea).not.toBeDisabled();
  });
});

describe('ResponseViewer', () => {
  it('pretty-prints JSON bodies in the body tab', () => {
    render(
      <ResponseViewer
        result={{
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: '{"hello":"world","n":1}',
          url: 'https://x.example.com/',
          method: 'GET',
          durationMs: 42,
        }}
        error={null}
        lang="en"
      />
    );
    // The body tab is selected by default; the pretty-printed output
    // contains a newline between keys, so we look for the formatted shape.
    expect(screen.getByText(/"hello": "world"/)).toBeInTheDocument();
  });

  it('shows a 4xx status pill in amber tones', () => {
    render(
      <ResponseViewer
        result={{
          status: 404,
          statusText: 'Not Found',
          headers: {},
          body: '',
          url: 'https://x.example.com/',
          method: 'GET',
          durationMs: 7,
        }}
        error={null}
        lang="en"
      />
    );
    const pill = screen.getByText(/404 Not Found/);
    expect(pill.className).toMatch(/amber/);
  });

  it('renders an error block when error is provided', () => {
    render(
      <ResponseViewer
        result={null}
        error={{ status: 0, message: 'ECONNREFUSED', reason: undefined }}
        lang="en"
      />
    );
    expect(screen.getByText(/Request failed/i)).toBeInTheDocument();
    expect(screen.getByText(/ECONNREFUSED/)).toBeInTheDocument();
  });
});

describe('PendingHttpStepBanner', () => {
  it('does nothing when localStorage is empty', () => {
    const onImport = jest.fn();
    render(<PendingHttpStepBanner lang="en" onImport={onImport} />);
    expect(screen.queryByText(/HTTP request ready to import/i)).not.toBeInTheDocument();
  });

  it('shows the banner when a fresh pending step is in localStorage', async () => {
    window.localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        type: 'operari.httpRequest',
        config: { method: 'GET', url: 'https://api.example.com/health' },
        createdAt: Date.now(),
      })
    );
    const onImport = jest.fn();
    render(<PendingHttpStepBanner lang="en" onImport={onImport} />);
    await waitFor(() => {
      expect(screen.getByText(/HTTP request ready to import/i)).toBeInTheDocument();
    });
  });

  it('calls onImport with the config and clears localStorage on click', async () => {
    const config = {
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: { 'X-Auth': 'token' },
    };
    window.localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ type: 'operari.httpRequest', config, createdAt: Date.now() })
    );
    const onImport = jest.fn();
    render(<PendingHttpStepBanner lang="en" onImport={onImport} />);
    const importBtn = await screen.findByRole('button', { name: /insert as step/i });
    fireEvent.click(importBtn);
    expect(onImport).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'operari.httpRequest', config })
    );
    expect(window.localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('auto-clears stale entries (>30min old) without showing a banner', () => {
    window.localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        type: 'operari.httpRequest',
        config: { method: 'GET', url: 'https://x.example.com/' },
        createdAt: Date.now() - 60 * 60 * 1000, // 1 hour ago
      })
    );
    render(<PendingHttpStepBanner lang="en" onImport={jest.fn()} />);
    expect(screen.queryByText(/HTTP request ready to import/i)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('clears localStorage on dismiss', async () => {
    window.localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        type: 'operari.httpRequest',
        config: { method: 'GET', url: 'https://x.example.com/' },
        createdAt: Date.now(),
      })
    );
    render(<PendingHttpStepBanner lang="en" onImport={jest.fn()} />);
    const dismiss = await screen.findByRole('button', { name: /dismiss/i });
    fireEvent.click(dismiss);
    expect(window.localStorage.getItem(PENDING_KEY)).toBeNull();
  });
});
