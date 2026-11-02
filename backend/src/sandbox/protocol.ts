import { z } from 'zod';

/**
 * Wire format between the backend and the sandbox-runner. The backend only
 * describes what to run; every container flag is decided by the runner, so
 * nothing here can widen the profile (no raw docker args, no volumes, no
 * network names, images only from the runner's allowlist).
 */

const id = z.string().min(1).max(200);

export const runRequestSchema = z.object({
  spec: z.object({
    command: z.string().max(1_000_000),
    shell: z.enum(['sh', 'bash']).optional(),
    cwd: z
      .string()
      .max(1024)
      .regex(/^\/[^\0]*$/)
      .optional(),
    env: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), z.string().max(64_000)).optional(),
    timeoutMs: z.number().int().positive().optional(),
    image: z.string().max(300).optional(),
    network: z.enum(['none', 'allowlist', 'open']).optional(),
    resources: z
      .object({
        cpuMillis: z.number().int().positive().optional(),
        memoryMb: z.number().int().positive().optional(),
      })
      .optional(),
  }),
  context: z.object({ runId: id, stepId: id, tenantId: id }),
});
export type RunRequest = z.infer<typeof runRequestSchema>;

export const cancelRequestSchema = z.object({ runId: id });

export const terminalOpenSchema = z.object({
  tenantId: id,
  userId: id,
  cols: z.number().int().min(10).max(500),
  rows: z.number().int().min(5).max(200),
  persistent: z.boolean(),
});
export type TerminalOpenRequest = z.infer<typeof terminalOpenSchema>;

export const terminalInputSchema = z.object({ data: z.string().max(64 * 1024) });
export const terminalResizeSchema = z.object({
  cols: z.number().int().min(10).max(500),
  rows: z.number().int().min(5).max(200),
});

/** One JSON object per line on streaming responses. */
export type RunStreamLine =
  | { t: 'stdout' | 'stderr'; d: string }
  | {
      t: 'result';
      exitCode: number | null;
      stdout: string;
      stderr: string;
      timedOut: boolean;
      durationMs: number;
    }
  | { t: 'error'; message: string };

export type TerminalStreamLine = { t: 'data'; d: string } | { t: 'exit'; code: number | null };

export const LIMITS = {
  maxTimeoutMs: 60 * 60_000,
  maxMemoryMb: 2048,
  maxCpuMillis: 2000,
};
