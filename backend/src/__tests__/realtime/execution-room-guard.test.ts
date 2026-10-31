import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import { SocketService } from '../../editor/execution/socket.service';
import { authenticateHandshake } from '../../realtime/socket-auth';

jest.mock('../../config/logger.config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../config/redis.config', () => ({
  redisConfig: { getClient: () => null, isReady: () => false },
}));
jest.mock('../../observability/log-stream.service', () => ({
  getLogStream: () => ({ publish: jest.fn() }),
}));

const ORIGIN = 'http://app.test';

describe('execution room guard', () => {
  let http: HttpServer;
  let service: SocketService;
  let base: string;
  const clients: ClientSocket[] = [];

  beforeEach(done => {
    http = createServer();
    // Fresh instance per test: the exported singleton keeps state.
    service = new (SocketService as unknown as { new (): SocketService })();
    service.initialize(http, ORIGIN);
    service.setGuard({
      authenticate: socket =>
        authenticateHandshake(socket, {
          allowedOrigins: [ORIGIN],
          verifyToken: async token =>
            token === 'tenant-a' ? { id: 'u1', email: 'a@x', tenantId: 'A' } : null,
        }),
      canJoin: async (user, executionId) => user.tenantId === 'A' && executionId === 'exec-a',
    });
    http.listen(0, () => {
      base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
      done();
    });
  });

  afterEach(done => {
    clients.splice(0).forEach(c => c.disconnect());
    service.getServer()?.close(() => done());
  });

  function connect(token?: string): ClientSocket {
    const c = ioClient(base, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: token ? { token } : {},
    });
    clients.push(c);
    return c;
  }

  it('refuses unauthenticated clients', async () => {
    const err = await new Promise<Error & { data?: { code: string } }>(resolve =>
      connect().on('connect_error', (e: Error) => resolve(e as never))
    );
    expect(err.data?.code).toBe('unauthorized');
  });

  it('streams logs for own-tenant executions only', async () => {
    const c = connect('tenant-a');
    await new Promise<void>(resolve => c.on('connect', () => resolve()));

    const denied = new Promise<{ executionId: string }>(resolve => c.on('join_denied', resolve));
    c.emit('join_execution', 'exec-b');
    expect(await denied).toEqual({ executionId: 'exec-b' });

    c.emit('join_execution', 'exec-a');
    await new Promise(r => setTimeout(r, 50));

    const received: string[] = [];
    c.on('log', (l: { message: string }) => received.push(l.message));
    service.emitLog('exec-b', 'secret from B');
    service.emitLog('exec-a', 'hello A');
    await new Promise(r => setTimeout(r, 50));
    expect(received).toEqual(['hello A']);
  });
});
