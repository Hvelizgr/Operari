import { PrismaClient } from '@prisma/client';

import { WaitpointService } from '../services/waitpoint.service';
import {
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

export interface WaitpointConfig {
  /**
   * Optional human-friendly tag list — surfaces in the operator
   * dashboard so a stale "deploy approval" token is easy to spot
   * weeks later.
   */
  tags?: string[];
  /**
   * Auto-time-out after this many seconds. Without it the token
   * waits forever (useful when an external system is the sole
   * caller and missing-callback should escalate, not auto-resolve).
   */
  timeoutSeconds?: number;
  /**
   * Optional message used only in the emitted log line — handy
   * when a runbook has several waitpoints and the operator wants
   * to see which is which without opening the inspector.
   */
  message?: string;
}

/**
 * Waitpoint step — pauses the run until an external POST to
 *   /api/waitpoints/<id>/complete
 * fulfils the token, or the watchdog times it out.
 *
 * Thin wrapper around WaitpointService.create. The interesting
 * work happens elsewhere:
 *   - Engine: sees `paused: true` and snapshots resume state.
 *   - Routes: POST /complete updates the row + calls
 *     ExecutionService.resumeExecution with the value as input.
 *   - Watchdog: per-minute sweep flips overdue tokens to TIMED_OUT.
 *
 * The executor returns the public URL in its output so downstream
 * steps can read `{{steps.<this-step>.output.url}}` if a parent
 * step needs to hand the URL to a vendor first.
 */
export class WaitpointExecutor implements StepExecutor<WaitpointConfig> {
  readonly type = 'waitpoint';

  constructor(private readonly prisma: PrismaClient) {}

  async execute(config: WaitpointConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const message = config.message ? resolveTemplate(config.message, context) : null;

    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] would mint waitpoint${message ? `: ${message}` : ''}`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: {
          dryRun: true,
          status: 'AUTO_COMPLETED',
          message,
        },
        duration: 0,
      };
    }

    const svc = new WaitpointService(this.prisma);
    const row = await svc.create({
      tenantId: context.tenantId,
      executionId: context.runId,
      timeoutMs:
        typeof config.timeoutSeconds === 'number' && config.timeoutSeconds > 0
          ? config.timeoutSeconds * 1000
          : null,
      tags: config.tags ?? [],
    });

    const base = process.env.APP_URL || 'http://localhost:3000';
    const url = `${base.replace(/\/$/, '')}/api/waitpoints/${row.id}/complete`;

    context.emit?.({
      type: 'log',
      text: `Waitpoint minted${message ? ` (${message})` : ''}: ${url}`,
      timestamp: new Date(),
    });

    return {
      success: true,
      paused: true,
      output: {
        waitpointId: row.id,
        url,
        status: 'PENDING',
        message,
        expiresAt: row.expiresAt?.toISOString() ?? null,
      },
      duration: Date.now() - startTime,
    };
  }
}
