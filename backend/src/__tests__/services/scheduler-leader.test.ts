// env.config validates JWT_SECRET (min 32 chars) at import time and calls
// process.exit on failure. scheduler-leader imports env.config transitively,
// so we install compliant values BEFORE the import chain resolves.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import { EventEmitter } from 'events';

/**
 * SchedulerLeader tests. We mock `pg` so none of the behavior depends
 * on a real database — the contract we care about is: call
 * pg_try_advisory_lock, observe the boolean, route callbacks, and
 * survive a connection drop.
 */

type QueryFn = jest.Mock<Promise<{ rows: Array<{ got?: boolean }> }>, [string, unknown[]?]>;

interface FakeClient extends EventEmitter {
  connect: jest.Mock;
  end: jest.Mock;
  query: QueryFn;
}

const clients: FakeClient[] = [];

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => {
    const client = new EventEmitter() as FakeClient;
    client.connect = jest.fn().mockResolvedValue(undefined);
    client.end = jest.fn().mockResolvedValue(undefined);
    client.query = jest.fn().mockResolvedValue({ rows: [{ got: true }] }) as QueryFn;
    clients.push(client);
    return client;
  }),
}));

// Import AFTER mock so the module picks up the mocked pg.Client.

const { SchedulerLeader } =
  require('../../services/scheduler-leader') as typeof import('../../services/scheduler-leader');

beforeEach(() => {
  clients.length = 0;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('SchedulerLeader', () => {
  it('calls onAcquire when pg_try_advisory_lock returns true', async () => {
    const onAcquire = jest.fn().mockResolvedValue(undefined);
    const onLose = jest.fn().mockResolvedValue(undefined);
    const leader = new SchedulerLeader({
      onAcquire,
      onLose,
      connectionString: 'postgres://test/test',
    });

    await leader.start();

    expect(onAcquire).toHaveBeenCalledTimes(1);
    expect(onLose).not.toHaveBeenCalled();
    expect(leader.isLeader()).toBe(true);
    expect(clients[0]!.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_try_advisory_lock'),
      [expect.any(String)]
    );

    await leader.stop();
  });

  it('stays follower when lock is held elsewhere, then acquires on a later poll', async () => {
    const onAcquire = jest.fn().mockResolvedValue(undefined);
    const onLose = jest.fn().mockResolvedValue(undefined);
    const leader = new SchedulerLeader({
      onAcquire,
      onLose,
      pollIntervalMs: 1000,
      connectionString: 'postgres://test/test',
    });

    // First attempt: lock busy. Second: free.
    clients.length = 0;
    // Client was not yet created (constructor runs in start()); set up
    // the future queue by swapping the mock implementation.
    const pg = jest.requireMock('pg') as { Client: jest.Mock };
    let call = 0;
    pg.Client.mockImplementation(() => {
      const client = new EventEmitter() as FakeClient;
      client.connect = jest.fn().mockResolvedValue(undefined);
      client.end = jest.fn().mockResolvedValue(undefined);
      client.query = jest.fn().mockImplementation(async () => {
        call += 1;
        return { rows: [{ got: call >= 2 }] };
      });
      clients.push(client);
      return client;
    });

    await leader.start();
    expect(leader.isLeader()).toBe(false);
    expect(onAcquire).not.toHaveBeenCalled();

    // Advance past the poll interval; the retry should succeed.
    await jest.advanceTimersByTimeAsync(1100);

    expect(leader.isLeader()).toBe(true);
    expect(onAcquire).toHaveBeenCalledTimes(1);

    await leader.stop();
  });

  it('calls onLose when the dedicated pg connection errors out', async () => {
    const onAcquire = jest.fn().mockResolvedValue(undefined);
    const onLose = jest.fn().mockResolvedValue(undefined);
    const leader = new SchedulerLeader({
      onAcquire,
      onLose,
      connectionString: 'postgres://test/test',
    });

    await leader.start();
    expect(leader.isLeader()).toBe(true);

    // Simulate a connection drop.
    clients[0]!.emit('error', new Error('connection terminated'));
    // The handler is async; give microtasks a chance to flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(onLose).toHaveBeenCalledTimes(1);
    expect(leader.isLeader()).toBe(false);

    await leader.stop();
  });

  it('releases the lock if onAcquire throws', async () => {
    const onAcquire = jest.fn().mockRejectedValue(new Error('boom'));
    const onLose = jest.fn().mockResolvedValue(undefined);
    const leader = new SchedulerLeader({
      onAcquire,
      onLose,
      connectionString: 'postgres://test/test',
    });

    await leader.start();

    expect(leader.isLeader()).toBe(false);
    // Two queries: the lock attempt, then the unlock after the callback threw.
    const queries = clients[0]!.query.mock.calls.map(c => c[0]);
    expect(queries.some(q => q.includes('pg_try_advisory_lock'))).toBe(true);
    expect(queries.some(q => q.includes('pg_advisory_unlock'))).toBe(true);

    await leader.stop();
  });

  it('stop() unlocks when leader and is idempotent', async () => {
    const leader = new SchedulerLeader({
      onAcquire: jest.fn().mockResolvedValue(undefined),
      onLose: jest.fn().mockResolvedValue(undefined),
      connectionString: 'postgres://test/test',
    });

    await leader.start();
    await leader.stop();

    const queries = clients[0]!.query.mock.calls.map(c => c[0]);
    expect(queries.some(q => q.includes('pg_advisory_unlock'))).toBe(true);
    expect(clients[0]!.end).toHaveBeenCalledTimes(1);

    // Second stop must not throw.
    await expect(leader.stop()).resolves.toBeUndefined();
  });

  it('refuses start() after stop()', async () => {
    const leader = new SchedulerLeader({
      onAcquire: jest.fn().mockResolvedValue(undefined),
      onLose: jest.fn().mockResolvedValue(undefined),
      connectionString: 'postgres://test/test',
    });

    await leader.start();
    await leader.stop();

    await expect(leader.start()).rejects.toThrow(/after stop/);
  });
});
