import Redis from 'ioredis';

import { blockedTarget } from '../../security/ssrf-guard';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

export interface RedisConfig {
  /** redis://user:pass@host:6379/0 — usually `{{secrets.<id>}}`. */
  url: string;
  operation: 'get' | 'set' | 'del' | 'incr' | 'expire' | 'publish';
  key?: string;
  value?: string;
  /** Seconds; applies to set and expire. 0 = no expiry. */
  ttl?: number;
  channel?: string;
}

type RedisLike = Pick<
  Redis,
  'connect' | 'disconnect' | 'get' | 'set' | 'del' | 'incr' | 'expire' | 'publish'
>;

/**
 * Redis — read or flip feature flags, clear a cache key, bump a counter
 * or publish to a channel the service listens on.
 */
export class RedisExecutor implements StepExecutor<RedisConfig> {
  readonly type = 'operari.redis';

  constructor(
    private readonly createClient: (url: string) => RedisLike = url =>
      new Redis(url, {
        lazyConnect: true,
        connectTimeout: 10_000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      })
  ) {}

  async execute(config: RedisConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const fail = (error: string): ExecutorResult => ({
      success: false,
      error,
      duration: Date.now() - startTime,
    });
    const url = r(config.url);
    const op = config.operation ?? 'get';
    const key = r(config.key);
    const channel = r(config.channel);
    const value = r(config.value);
    const ttl = Number(config.ttl ?? 0);

    if (!url) return fail('url is required');
    if (!/^rediss?:\/\//.test(url)) return fail('url must start with redis:// or rediss://');
    if (op === 'publish' ? !channel : !key)
      return fail(op === 'publish' ? 'channel is required' : 'key is required');
    if (op === 'expire' && !(ttl > 0)) return fail('ttl must be greater than 0 to expire a key');

    const blocked = await blockedTarget('host', new URL(url).hostname);
    if (blocked) return fail(`redis: ${blocked}`);

    const target = op === 'publish' ? `channel ${channel}` : `key ${key}`;
    context.emit?.({
      type: 'log',
      text: `redis ${op.toUpperCase()} ${target}`,
      timestamp: new Date(),
    });
    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] would redis ${op} ${target}`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: { dryRun: true, operation: op },
        duration: Date.now() - startTime,
      };
    }

    const client = this.createClient(url);
    try {
      await client.connect();
      let result: unknown;
      switch (op) {
        case 'get':
          result = await client.get(key);
          break;
        case 'set':
          result = ttl > 0 ? await client.set(key, value, 'EX', ttl) : await client.set(key, value);
          break;
        case 'del':
          result = await client.del(key);
          break;
        case 'incr':
          result = await client.incr(key);
          break;
        case 'expire':
          result = await client.expire(key, ttl);
          break;
        case 'publish':
          result = await client.publish(channel, value);
          break;
        default:
          return fail(`unknown operation "${op as string}"`);
      }
      return {
        success: true,
        output: { operation: op, ...(op === 'publish' ? { channel } : { key }), result },
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return fail(`redis ${op}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      client.disconnect();
    }
  }
}
