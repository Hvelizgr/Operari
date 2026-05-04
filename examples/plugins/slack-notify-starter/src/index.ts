import { defineStep } from '@operari/sdk/steps';
import { z } from 'zod';

/**
 * Slack-notify step — production-shaped Operari plugin starter.
 *
 * Three things this template demonstrates that the minimal
 * `hello-world` example doesn't:
 *
 *   1. Real zod schema with multiple fields + per-field constraints —
 *      typed `config` inside execute(), validated before the call.
 *   2. Outbound HTTP via global fetch (Node 18+) with an explicit
 *      timeout. Plugins should never hang the engine on a slow vendor.
 *   3. Structured success/failure return + emit() log lines so the
 *      run detail page shows what happened.
 *
 * Conventions:
 *   - The `type` MUST be namespaced (`<org>.<step-name>`). Unprefixed
 *     names collide with reserved core types and the loader will
 *     reject them at startup.
 *   - Secrets should travel as `{{secrets.<connected-account-id>}}`
 *     references; the orchestrator pre-resolves them into
 *     `context.secrets` before execute() runs.
 *   - `execute` returns ExecutorResult — { success, output?, error?,
 *     paused? }. Throwing also works (the loader catches and shapes
 *     it as a FAILED result), but explicit returns make the failure
 *     mode clearer in the run log.
 */

const config = z.object({
  /** Slack incoming webhook URL. */
  webhookUrl: z.string().url(),
  /** Message body — supports template substitution. */
  message: z.string().min(1).max(4000),
  /** Optional channel override (Slack honours `#channel`). */
  channel: z.string().optional(),
  /** Network timeout. Default: 10s. */
  timeoutMs: z.number().int().positive().max(60_000).default(10_000),
});

export default defineStep({
  type: 'example.slack-notify',
  configSchema: config,
  async execute(cfg, ctx) {
    const startedAt = Date.now();

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      ctx.emit?.({
        type: 'log',
        text: `Posting to Slack${cfg.channel ? ` (${cfg.channel})` : ''}...`,
        timestamp: new Date(),
      });

      const res = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cfg.message,
          ...(cfg.channel ? { channel: cfg.channel } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        return {
          success: false,
          error: `slack returned ${res.status}: ${await res.text().catch(() => '')}`,
          duration: Date.now() - startedAt,
        };
      }

      return {
        success: true,
        output: { status: res.status, channel: cfg.channel ?? null },
        duration: Date.now() - startedAt,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        success: false,
        error: aborted ? `slack request timed out after ${cfg.timeoutMs}ms` : message,
        duration: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(t);
    }
  },
});
