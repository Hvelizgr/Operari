import { Client } from 'pg';

import { env } from '../config/env.config';
import { logger } from '../config/logger.config';

/**
 * Single-leader coordinator for the cron scheduler.
 *
 * Background: SchedulerService registers node-cron tasks in the local
 * process. With more than one backend pod, every pod registers the same
 * tasks and every cron tick fires N runs — duplicating side effects,
 * double-billing, corrupting non-idempotent runbooks.
 *
 * This coordinator serializes "who owns the scheduler" across pods
 * using a Postgres session-level advisory lock. Exactly one pod holds
 * the lock and runs the scheduler; the others poll and take over only
 * after the current leader's connection dies.
 *
 * Why a dedicated pg.Client instead of reusing the Prisma pool: Prisma
 * opens and closes pool connections at will. pg_advisory_lock lives for
 * the lifetime of the acquiring session, so running it through Prisma
 * means the lock can disappear mid-lease when the connection returns to
 * the pool and another query reuses it. The dedicated Client keeps one
 * connection pinned for the duration of the leadership.
 */

/**
 * Stable advisory-lock key for the scheduler. Any integer that doesn't
 * collide with other advisory locks in the same database is fine;
 * chosen from the ASCII of "NSCHED" so it's grep-able in pg_locks.
 * Treated as a signed bigint by Postgres.
 */
const SCHEDULER_LOCK_KEY = 8241330121411232075n; // "NANOSCHD" as bigint-ish

export interface SchedulerLeaderOptions {
  /** Called the moment this pod acquires leadership. */
  onAcquire: () => Promise<void> | void;
  /** Called if leadership is lost (connection drop). May be called more
   *  than once if the pod re-acquires and loses again. */
  onLose: () => Promise<void> | void;
  /** How often non-leader pods retry the lock. Defaults to 5s. */
  pollIntervalMs?: number;
  /** Override the pg connection string. Defaults to env.DATABASE_URL. */
  connectionString?: string;
}

export class SchedulerLeader {
  private client: Client | null = null;
  private options: Required<Omit<SchedulerLeaderOptions, 'connectionString'>> &
    Pick<SchedulerLeaderOptions, 'connectionString'>;
  private leader = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(options: SchedulerLeaderOptions) {
    this.options = {
      pollIntervalMs: 5000,
      ...options,
    };
  }

  /** True when this pod currently holds the scheduler lock. */
  isLeader(): boolean {
    return this.leader;
  }

  /**
   * Open the dedicated pg connection and try to acquire leadership.
   * Callers should await this — it resolves after the first attempt so
   * the server can log "leader" vs "follower" deterministically, but the
   * periodic retry loop continues in the background either way.
   */
  async start(): Promise<void> {
    if (this.stopped) {
      throw new Error('SchedulerLeader.start() called after stop()');
    }
    await this.openClient();
    await this.tryAcquire();
    this.schedulePoll();
  }

  /**
   * Release the lock (if held) and close the dedicated connection.
   * Idempotent — safe to call on SIGTERM even if start() failed.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (!this.client) return;
    try {
      if (this.leader) {
        await this.client.query('SELECT pg_advisory_unlock($1)', [SCHEDULER_LOCK_KEY.toString()]);
        this.leader = false;
      }
    } catch (err) {
      // We are shutting down; a failing unlock just means the session
      // already closed, which releases the lock anyway.
      logger.debug(
        { err },
        'SchedulerLeader: unlock during stop failed (lock likely already released)'
      );
    }
    try {
      await this.client.end();
    } catch {
      /* ignore */
    }
    this.client = null;
  }

  private async openClient(): Promise<void> {
    const client = new Client({
      connectionString: this.options.connectionString ?? env.DATABASE_URL,
      // Short application_name so pg_stat_activity surfaces this
      // connection clearly to operators debugging "who holds the lock".
      application_name: 'operari-scheduler-leader',
    });
    client.on('error', err => {
      // Connection-level error: the lock is dead. Drop leadership so
      // the poll loop can try to re-acquire (possibly on a new client).
      logger.warn({ err }, 'SchedulerLeader: dedicated pg connection error');
      void this.handleConnectionLoss();
    });
    await client.connect();
    this.client = client;
  }

  private async handleConnectionLoss(): Promise<void> {
    const wasLeader = this.leader;
    this.leader = false;
    this.client = null;
    if (wasLeader) {
      try {
        await this.options.onLose();
      } catch (err) {
        logger.error({ err }, 'SchedulerLeader: onLose callback threw');
      }
    }
    if (this.stopped) return;
    // Reopen on next poll tick. Schedule immediately.
    this.schedulePoll(100);
  }

  private async tryAcquire(): Promise<void> {
    if (this.leader || this.stopped) return;
    if (!this.client) {
      try {
        await this.openClient();
      } catch (err) {
        logger.error({ err }, 'SchedulerLeader: failed to open dedicated pg connection');
        return;
      }
    }
    try {
      const result = await this.client!.query<{ got: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS got',
        [SCHEDULER_LOCK_KEY.toString()]
      );
      const got = result.rows[0]?.got === true;
      if (got) {
        this.leader = true;
        logger.info('SchedulerLeader: acquired leadership');
        try {
          await this.options.onAcquire();
        } catch (err) {
          // Acquire callback threw — release the lock so another pod can
          // pick it up. We cannot run the scheduler locally anyway.
          logger.error({ err }, 'SchedulerLeader: onAcquire callback threw, releasing lock');
          try {
            await this.client!.query('SELECT pg_advisory_unlock($1)', [
              SCHEDULER_LOCK_KEY.toString(),
            ]);
          } catch {
            /* ignore */
          }
          this.leader = false;
        }
      }
    } catch (err) {
      logger.error({ err }, 'SchedulerLeader: pg_try_advisory_lock query failed');
    }
  }

  private schedulePoll(delayMs?: number): void {
    if (this.stopped) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.tryAcquire().finally(() => this.schedulePoll());
    }, delayMs ?? this.options.pollIntervalMs);
  }
}
