import { act, fireEvent, render, screen } from '@testing-library/react';

import TerminalCanvas from '@/components/Terminal/TerminalCanvas';

type Handler = (...args: unknown[]) => void;

const sockets: FakeSocket[] = [];
class FakeSocket {
  handlers: Record<string, Handler> = {};
  emitted: Array<[string, unknown]> = [];
  disconnected = false;
  constructor(
    readonly url: string,
    readonly opts: Record<string, unknown>
  ) {}
  on(event: string, h: Handler) {
    this.handlers[event] = h;
    return this;
  }
  emit(event: string, payload?: unknown) {
    this.emitted.push([event, payload]);
    return this;
  }
  disconnect() {
    this.disconnected = true;
  }
  fire(event: string, payload?: unknown) {
    act(() => this.handlers[event]?.(payload));
  }
}

jest.mock('socket.io-client', () => ({
  io: (url: string, opts: Record<string, unknown>) => {
    const s = new FakeSocket(url, opts);
    sockets.push(s);
    return s;
  },
}));

const terms: FakeTerminal[] = [];
class FakeTerminal {
  cols = 80;
  rows = 24;
  written: string[] = [];
  disposed = false;
  dataHandler: ((d: string) => void) | null = null;
  constructor() {
    terms.push(this);
  }
  loadAddon() {}
  open() {}
  focus() {}
  write(d: string) {
    this.written.push(d);
  }
  onData(h: (d: string) => void) {
    this.dataHandler = h;
    return { dispose: () => undefined };
  }
  onResize() {
    return { dispose: () => undefined };
  }
  dispose() {
    this.disposed = true;
  }
}

jest.mock('@xterm/xterm', () => ({ Terminal: jest.fn(() => new FakeTerminal()) }));
jest.mock('@xterm/addon-fit', () => ({ FitAddon: jest.fn(() => ({ fit: jest.fn() })) }));
jest.mock('@xterm/xterm/css/xterm.css', () => ({}), { virtual: true });

beforeAll(() => {
  (global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

beforeEach(() => {
  sockets.length = 0;
  terms.length = 0;
});

describe('TerminalCanvas', () => {
  it('opens a session sized to the terminal and pipes input and output', () => {
    render(<TerminalCanvas lang="en" />);
    const socket = sockets[0];
    expect(socket.url).toMatch(/\/terminal$/);
    expect(socket.opts).toMatchObject({ withCredentials: true, transports: ['websocket'] });

    socket.fire('connect');
    expect(socket.emitted).toContainEqual(['open', { cols: 80, rows: 24 }]);

    socket.fire('opened', { sessionId: 's1', runner: 'docker' });
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('container')).toBeInTheDocument();

    socket.fire('output', 'hello');
    expect(terms[0].written).toContain('hello');

    act(() => terms[0].dataHandler?.('ls\r'));
    expect(socket.emitted).toContainEqual(['input', 'ls\r']);
  });

  it('explains a permission rejection in the user language', () => {
    render(<TerminalCanvas lang="es" />);
    const err = Object.assign(new Error('Missing permission'), {
      data: { code: 'permission_denied' },
    });
    sockets[0].fire('connect_error', err);
    expect(screen.getByRole('alert')).toHaveTextContent('terminal:open');
    expect(screen.getByText('Nueva sesión')).toBeInTheDocument();
  });

  it('starts a fresh session after the previous one ends', () => {
    render(<TerminalCanvas lang="en" />);
    sockets[0].fire('opened', { sessionId: 's1', runner: 'local' });
    sockets[0].fire('exit', { exitCode: 0, reason: 'exit' });
    expect(screen.getByText('Session ended')).toBeInTheDocument();

    fireEvent.click(screen.getByText('New session'));
    expect(sockets[0].disconnected).toBe(true);
    expect(terms[0].disposed).toBe(true);
    expect(sockets).toHaveLength(2);
  });
});
