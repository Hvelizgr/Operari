import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';

import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

/*
 * Pure data steps — no side effects, so dry-run runs them for real and
 * downstream templates see the same values they will in a live run.
 */

const ok = (output: Record<string, unknown>, startTime: number): ExecutorResult => ({
  success: true,
  output,
  duration: Date.now() - startTime,
});
const fail = (error: string, startTime: number): ExecutorResult => ({
  success: false,
  error,
  duration: Date.now() - startTime,
});

function resolveDeep(value: unknown, context: ExecutorContext): unknown {
  if (typeof value === 'string') return resolveTemplate(value, context);
  if (Array.isArray(value)) return value.map(v => resolveDeep(v, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolveDeep(v, context)])
    );
  }
  return value;
}

export interface SetConfig {
  /** JSON object; string values accept templates. */
  fields: string | Record<string, unknown>;
}

/** Edit Fields — name values once so later steps read `{{steps.<id>.output.<field>}}`. */
export class SetExecutor implements StepExecutor<SetConfig> {
  readonly type = 'operari.set';

  async execute(config: SetConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    let fields: unknown = config.fields ?? {};
    if (typeof fields === 'string') {
      try {
        fields = fields.trim() ? JSON.parse(fields) : {};
      } catch (err) {
        return fail(`fields is not valid JSON: ${(err as Error).message}`, startTime);
      }
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return fail('fields must be a JSON object', startTime);
    }
    const output = resolveDeep(fields, context) as Record<string, unknown>;
    context.emit?.({
      type: 'log',
      text: `set ${Object.keys(output).join(', ') || '(nothing)'}`,
      timestamp: new Date(),
    });
    return ok(output, startTime);
  }
}

export interface CryptoConfig {
  action: 'hash' | 'hmac' | 'uuid' | 'random';
  algorithm?: 'sha256' | 'sha512' | 'sha1' | 'md5';
  value?: string;
  /** HMAC key — usually `{{secrets.<id>}}`. */
  secret?: string;
  encoding?: 'hex' | 'base64';
  /** Bytes of randomness for action = random. */
  length?: number;
}

/** Crypto — hash payloads, sign webhooks, mint ids and throwaway passwords. */
export class CryptoExecutor implements StepExecutor<CryptoConfig> {
  readonly type = 'operari.crypto';

  async execute(config: CryptoConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const action = config.action ?? 'hash';
    const algorithm = config.algorithm ?? 'sha256';
    const encoding = config.encoding ?? 'hex';
    if (!['sha256', 'sha512', 'sha1', 'md5'].includes(algorithm)) {
      return fail(`unsupported algorithm "${algorithm}"`, startTime);
    }
    switch (action) {
      case 'uuid':
        return ok({ value: randomUUID() }, startTime);
      case 'random': {
        const length = Math.min(Math.max(Number(config.length ?? 32), 1), 1024);
        return ok({ value: randomBytes(length).toString(encoding) }, startTime);
      }
      case 'hash':
        return ok(
          {
            value: createHash(algorithm)
              .update(resolveTemplate(config.value ?? '', context))
              .digest(encoding),
            algorithm,
          },
          startTime
        );
      case 'hmac': {
        const secret = resolveTemplate(config.secret ?? '', context);
        if (!secret) return fail('secret is required for hmac', startTime);
        return ok(
          {
            value: createHmac(algorithm, secret)
              .update(resolveTemplate(config.value ?? '', context))
              .digest(encoding),
            algorithm,
          },
          startTime
        );
      }
      default:
        return fail(`unknown action "${action as string}"`, startTime);
    }
  }
}

const UNIT_MS = { seconds: 1_000, minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;

export interface DateTimeConfig {
  action: 'now' | 'add' | 'subtract' | 'diff';
  /** ISO date or unix seconds; empty = now. */
  date?: string;
  amount?: number;
  unit?: keyof typeof UNIT_MS;
  /** Second date for action = diff. */
  compareTo?: string;
  /** IANA zone for the `local` field, e.g. America/Guatemala. */
  timezone?: string;
}

function parseDate(raw: string): Date | null {
  const v = raw.trim();
  if (!v) return new Date();
  const d = /^\d{9,10}$/.test(v)
    ? new Date(Number(v) * 1000)
    : /^\d{12,13}$/.test(v)
      ? new Date(Number(v))
      : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date & Time — compute "now minus 15 minutes" windows, deadlines and durations. */
export class DateTimeExecutor implements StepExecutor<DateTimeConfig> {
  readonly type = 'operari.dateTime';

  async execute(config: DateTimeConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const action = config.action ?? 'now';
    const base = parseDate(resolveTemplate(config.date ?? '', context));
    if (!base) return fail(`date "${config.date}" is not a valid date`, startTime);
    const unit = config.unit ?? 'minutes';
    if (!(unit in UNIT_MS)) return fail(`unknown unit "${unit}"`, startTime);

    if (action === 'diff') {
      const other = parseDate(resolveTemplate(config.compareTo ?? '', context));
      if (!other) return fail(`compareTo "${config.compareTo}" is not a valid date`, startTime);
      const ms = other.getTime() - base.getTime();
      return ok({ ms, seconds: Math.round(ms / 1000), [unit]: ms / UNIT_MS[unit] }, startTime);
    }

    const delta =
      action === 'now'
        ? 0
        : Number(config.amount ?? 0) * UNIT_MS[unit] * (action === 'subtract' ? -1 : 1);
    const d = new Date(base.getTime() + delta);
    let local: string;
    try {
      local = d.toLocaleString('sv-SE', { timeZone: config.timezone || 'UTC' }).replace(' ', 'T');
    } catch {
      return fail(`unknown timezone "${config.timezone}"`, startTime);
    }
    return ok(
      { iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), ms: d.getTime(), local },
      startTime
    );
  }
}

export interface StopAndErrorConfig {
  message: string;
}

/** Stop and Error — end the run as failed on purpose, e.g. on an unexpected branch. */
export class StopAndErrorExecutor implements StepExecutor<StopAndErrorConfig> {
  readonly type = 'operari.stopAndError';

  async execute(config: StopAndErrorConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const message =
      resolveTemplate(config.message ?? '', context) || 'Run stopped by a Stop and Error step';
    context.emit?.({ type: 'stderr', text: message, timestamp: new Date() });
    return { success: false, error: message, duration: 0 };
  }
}
