import type { Prisma, PrismaClient } from '@prisma/client';

import {
  type ExecutorContext,
  type ExecutorResult,
  resolveValue,
  type StepExecutor,
} from '../types/executor.types';

export interface NewItemsConfig {
  /** Expression resolving to a list, e.g. {{steps.list.output.data.items}}. */
  items: string;
  /** Field that identifies an item (dotted path). Empty compares whole items. */
  idField?: string;
  /** `skip` (default): the first run only records what exists, so enabling it does not flood. */
  firstRun?: 'skip' | 'emit';
  /** How many ids to remember; the oldest are forgotten first. */
  remember?: number;
}

const DEFAULT_REMEMBER = 5000;
const MAX_REMEMBER = 50_000;

interface Memory {
  seen: string[];
  initialized: boolean;
}

/**
 * "Only new items": remembers, across runs of the same runbook step, which
 * items it has already let through and outputs only the new ones. With a
 * schedule trigger and a list operation in front, it turns any API with a
 * list endpoint into a "new X" trigger. Memory lives in a StorageBucket row
 * per runbook step; a transaction-scoped advisory lock serialises
 * overlapping runs so an item is never emitted twice.
 */
export class NewItemsExecutor implements StepExecutor<NewItemsConfig> {
  readonly type = 'operari.newItems';

  constructor(private readonly prisma: PrismaClient) {}

  async execute(config: NewItemsConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const fail = (error: string): ExecutorResult => ({
      success: false,
      error,
      duration: Date.now() - startTime,
    });
    const list = resolveValue(config.items ?? '', context);
    if (!Array.isArray(list)) return fail('newItems: items must resolve to a list');
    const remember = Math.min(
      Math.max(1, Number(config.remember ?? DEFAULT_REMEMBER)),
      MAX_REMEMBER
    );
    const idField = (config.idField ?? '').trim();
    const keyOf = (item: unknown): string => {
      if (!idField) return JSON.stringify(item);
      const v = idField
        .split('.')
        .reduce<unknown>(
          (cur, k) =>
            cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined,
          item
        );
      return v === undefined || v === null ? JSON.stringify(item) : String(v);
    };

    const execution = await this.prisma.execution.findUnique({
      where: { id: context.runId },
      select: { runbookId: true },
    });
    const scope = execution?.runbookId ?? context.runId;
    const name = `newItems:${scope}:${context.stepId}`.slice(0, 190);

    if (context.dryRun) {
      return {
        success: true,
        output: { dryRun: true, items: [], count: 0, hasNew: false, seen: list.length },
        duration: Date.now() - startTime,
      };
    }

    const result = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${context.tenantId}:${name}`}))`;
      const row = await tx.storageBucket.findUnique({
        where: { tenantId_name: { tenantId: context.tenantId, name } },
      });
      const memory = (row?.data as unknown as Memory | null) ?? { seen: [], initialized: false };
      const seen = new Set(memory.seen);
      const fresh: unknown[] = [];
      const freshKeys: string[] = [];
      for (const item of list) {
        const key = keyOf(item);
        if (seen.has(key) || freshKeys.includes(key)) continue;
        freshKeys.push(key);
        fresh.push(item);
      }
      const first = !memory.initialized;
      const emitted = first && (config.firstRun ?? 'skip') === 'skip' ? [] : fresh;
      const next: Memory = {
        seen: [...memory.seen, ...freshKeys].slice(-remember),
        initialized: true,
      };
      const data = next as unknown as Prisma.InputJsonValue;
      await tx.storageBucket.upsert({
        where: { tenantId_name: { tenantId: context.tenantId, name } },
        create: { tenantId: context.tenantId, name, data },
        update: { data },
      });
      return { emitted, first, recorded: freshKeys.length };
    });

    if (result.first && result.emitted.length === 0 && result.recorded > 0) {
      context.emit?.({
        type: 'log',
        text: `newItems: first run, recorded ${result.recorded} existing item(s) without emitting them`,
        timestamp: new Date(),
      });
    }
    return {
      success: true,
      output: {
        items: result.emitted,
        count: result.emitted.length,
        hasNew: result.emitted.length > 0,
        firstRun: result.first,
      },
      duration: Date.now() - startTime,
    };
  }
}
