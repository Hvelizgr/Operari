import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server as SocketServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import type { TerminalSocketDeps } from '../../terminal/terminal.socket';
import { parseCookieHeader, registerTerminalNamespace } from '../../terminal/terminal.socket';
import {
  PtyProcess,
  PtySpawnOptions,
  TerminalSessionManager,
} from '../../terminal/terminal-session';

jest.mock('../../config/logger.config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

class FakePty implements PtyProcess {
  readonly pid = 1;
  written: string[] = [];
  private data: Array<(d: string) => void> = [];
  private exit: Array<(e: { exitCode: number }) => void> = [];
  constructor(readonly options: PtySpawnOptions) {}
  onData(l: (d: string) => void) {
    this.data.push(l);
    return { dispose: () => undefined };
  }
  onExit(l: (e: { exitCode: number }) => void) {
    this.exit.push(l);
    return { dispose: () => undefined };
  }
  write(d: string) {
    this.written.push(d);
    this.data.forEach(l => l(`echo:${d}`));
  }
  resize() {}
  kill() {}
  emitExit(code: number) {
    this.exit.forEach(l => l({ exitCode: code }));
  }
}

const ORIGIN = 'http://app.test';

describe('terminal socket namespace', () => {
  let http: HttpServer;
  let io: SocketServer;
  let url: string;
  let ptys: FakePty[];
  let deps: TerminalSocketDeps;
  let audit: jest.Mock;
  const clients: ClientSocket[] = [];

  beforeEach(done => {
    ptys = [];
    audit = jest.fn().mockResolvedValue({ id: 'a', hash: 'h', seq: BigInt(1) });
    deps = {
      allowedOrigins: [ORIGIN],
      verifyToken: jest.fn(async token =>
        token === 'good' ? { id: 'u1', email: 'u@x', tenantId: 't1' } : null
      ),
      hasPermission: jest.fn(async () => true),
      denyReason: jest.fn(() => null),
      manager: new TerminalSessionManager({
        runner: 'local',
        recordingsDir: null,
        workspacesDir: null,
        spawnPty: (_f, _a, options) => {
          const p = new FakePty(options);
          ptys.push(p);
          return p;
        },
      }),
      audit: { record: audit },
    };
    http = createServer();
    io = new SocketServer(http);
    registerTerminalNamespace(io, deps);
    http.listen(0, () => {
      url = `http://127.0.0.1:${(http.address() as AddressInfo).port}/terminal`;
      done();
    });
  });

  afterEach(done => {
    clients.splice(0).forEach(c => c.disconnect());
    deps.manager.closeAll();
    io.close(() => done());
  });

  function connect(opts: { token?: string; cookie?: string; origin?: string }): ClientSocket {
    const headers: Record<string, string> = {};
    if (opts.cookie) headers.cookie = opts.cookie;
    if (opts.origin) headers.origin = opts.origin;
    const c = ioClient(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: opts.token ? { token: opts.token } : {},
      extraHeaders: headers,
    });
    clients.push(c);
    return c;
  }

  function connectError(c: ClientSocket): Promise<{ message: string; data?: { code: string } }> {
    return new Promise(resolve => c.on('connect_error', (err: Error) => resolve(err as never)));
  }

  it('rejects a handshake without credentials', async () => {
    const err = await connectError(connect({}));
    expect(err.data?.code).toBe('unauthorized');
  });

  it('rejects a cookie handshake from a foreign origin', async () => {
    const err = await connectError(
      connect({ cookie: 'operari_session=good', origin: 'https://evil.test' })
    );
    expect(err.data?.code).toBe('bad_origin');
    expect(deps.verifyToken).not.toHaveBeenCalled();
  });

  it('rejects users without terminal:open', async () => {
    (deps.hasPermission as jest.Mock).mockResolvedValue(false);
    const err = await connectError(connect({ token: 'good' }));
    expect(err.data?.code).toBe('permission_denied');
    expect(deps.hasPermission).toHaveBeenCalledWith('u1', 'terminal:open');
  });

  it('rejects tenants the server does not allow a shell for', async () => {
    (deps.denyReason as jest.Mock).mockReturnValue('local runner has no isolation');
    const err = await connectError(connect({ token: 'good' }));
    expect(err).toMatchObject({ message: 'local runner has no isolation' });
  });

  it('opens a session over a same-origin cookie, round-trips input and audits both ends', async () => {
    const c = connect({ cookie: 'operari_session=good', origin: ORIGIN });
    const opened = await new Promise<{ sessionId: string; runner: string; persistent: boolean }>(
      resolve => {
        c.on('connect', () => c.emit('open', { cols: 90, rows: 20 }));
        c.on('opened', resolve);
      }
    );
    expect(opened).toMatchObject({ runner: 'local', persistent: false });
    expect(ptys[0].options.cols).toBe(90);

    const output = new Promise<string>(resolve => c.on('output', resolve));
    c.emit('input', 'pwd\r');
    expect(await output).toBe('echo:pwd\r');

    const exited = new Promise<{ exitCode: number; reason: string }>(resolve =>
      c.on('exit', resolve)
    );
    ptys[0].emitExit(0);
    expect(await exited).toEqual({ exitCode: 0, reason: 'exit' });

    await new Promise(r => setTimeout(r, 20));
    const types = audit.mock.calls.map(call => call[0].type);
    expect(types).toEqual(['terminal.opened', 'terminal.closed']);
    expect(audit.mock.calls[1][0].payload).toMatchObject({
      sessionId: opened.sessionId,
      exitCode: 0,
      recordingSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('kills the session when the client disconnects', async () => {
    const c = connect({ token: 'good' });
    await new Promise(resolve => {
      c.on('connect', () => c.emit('open', {}));
      c.on('opened', resolve);
    });
    expect(deps.manager.size).toBe(1);
    c.disconnect();
    await new Promise(r => setTimeout(r, 50));
    expect(deps.manager.size).toBe(0);
    expect(audit.mock.calls.at(-1)?.[0].payload.reason).toBe('disconnect');
  });
});

describe('parseCookieHeader', () => {
  it('parses and decodes cookies', () => {
    expect(parseCookieHeader('a=1; operari_session=abc%3D; bad')).toEqual({
      a: '1',
      operari_session: 'abc=',
    });
    expect(parseCookieHeader(undefined)).toEqual({});
  });
});
