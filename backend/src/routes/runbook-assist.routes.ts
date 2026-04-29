import type { ModelMessage } from 'ai';
import { Response, Router } from 'express';
import { z } from 'zod';

import { streamOrchestratorReply } from '../agent/orchestrator';
import { logger } from '../config/logger.config';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';

const router = Router();

// Anonymous fallback consistent with the rest of the editor surfaces.
router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@operari.local',
      role: 'USER',
      tenantId: 'default-tenant',
    };
  }
  next();
});

const diagnoseSchema = z.object({
  /** Optional run id — when present, real logs are pulled from the database. */
  runId: z.string().optional(),
  /** Optional step id — used together with runId to scope log retrieval. */
  stepId: z.string().optional(),
  /** Manual fallback context when the editor has no real run yet. */
  stepName: z.string().max(200).optional(),
  stepType: z.string().max(100).optional(),
  stepConfig: z.record(z.string(), z.unknown()).optional(),
  errorMessage: z.string().max(8000).optional(),
  stdout: z.string().max(16000).optional(),
  stderr: z.string().max(16000).optional(),
  /** Free-form follow-up question from the user. */
  question: z.string().max(2000).optional(),
});

type DiagnoseInput = z.infer<typeof diagnoseSchema>;

interface ResolvedContext {
  stepName: string;
  stepType: string;
  stepConfig?: Record<string, unknown>;
  errorMessage?: string;
  stdout?: string;
  stderr?: string;
  previousOutputs?: Array<{ stepName: string; output?: unknown }>;
}

/**
 * POST /api/runbook-assist/diagnose
 *
 * Streams an AI diagnosis for a failed step. The route accepts either:
 *   - {runId, stepId}: pulls the actual NodeLog row + previous step
 *     outputs from the database for full context, OR
 *   - manual fields: when the editor has no real run yet, the caller
 *     supplies stepName/stepType/errorMessage/stdout/stderr directly.
 *
 * Response is the Vercel AI SDK data stream protocol so the existing
 * frontend chat UI primitives can render it.
 */
router.post('/diagnose', async (req: AuthRequest, res: Response) => {
  let body: DiagnoseInput;
  try {
    body = diagnoseSchema.parse(req.body ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid body', details: err.errors });
    }
    throw err;
  }

  let context: ResolvedContext;
  try {
    context = await resolveContext(body, req.user!.tenantId);
  } catch (err) {
    logger.error({ err }, 'Failed to resolve diagnosis context');
    return res.status(500).json({ error: 'Failed to load run context' });
  }

  if (!context.errorMessage && !context.stderr && !context.stdout) {
    return res.status(400).json({
      error:
        'No failure context to diagnose. Provide errorMessage, stderr, or a runId/stepId pair.',
      code: 'no_context',
    });
  }

  const messages = buildPrompt(context, body.question);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Vercel-AI-Data-Stream', 'v1');

  try {
    const result = streamOrchestratorReply(messages, {
      tenantId: req.user!.tenantId,
      prisma,
    });
    // We iterate fullStream (not textStream) so the side-panel can
    // render the tool calls the orchestrator makes — list_recent_runs,
    // get_step_logs, etc. — as visible UI bubbles instead of a
    // suspicious silence between "Thinking..." and the final answer.
    //
    // Tag mapping mirrors the v1 Vercel AI SDK data-stream protocol so
    // the frontend parser only needs two new tags on top of `0:` text:
    //   9: tool-call    { toolCallId, toolName, args }
    //   a: tool-result  { toolCallId, result }
    //
    // Other event types (text-start/end, reasoning, finish-step,
    // start-step, raw warnings) are intentionally dropped — they're
    // protocol-level noise the side panel doesn't render.
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        res.write(`0:${JSON.stringify(part.text)}\n`);
      } else if (part.type === 'tool-call') {
        res.write(
          `9:${JSON.stringify({
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            args: part.input,
          })}\n`
        );
      } else if (part.type === 'tool-result') {
        res.write(
          `a:${JSON.stringify({
            toolCallId: part.toolCallId,
            result: part.output,
          })}\n`
        );
      } else if (part.type === 'tool-error') {
        // Surface tool errors as a "result" with an error envelope so
        // the UI can render them in the same slot as a real result —
        // a dedicated tag would mean a third frontend code path for
        // an event the model rarely emits.
        res.write(
          `a:${JSON.stringify({
            toolCallId: part.toolCallId,
            result: { ok: false, error: String(part.error) },
          })}\n`
        );
      }
    }
    res.write(`d:${JSON.stringify({ finishReason: 'stop' })}\n`);
    res.end();
  } catch (err) {
    logger.error({ err }, 'Diagnose stream failed');
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Diagnose stream failed' });
    }
    res.write(`0:${JSON.stringify('Sorry, the AI assistant is unavailable right now.')}\n`);
    res.write(`d:${JSON.stringify({ finishReason: 'error' })}\n`);
    res.end();
  }
});

async function resolveContext(body: DiagnoseInput, tenantId: string): Promise<ResolvedContext> {
  const ctx: ResolvedContext = {
    stepName: body.stepName ?? 'unknown step',
    stepType: body.stepType ?? 'unknown',
    stepConfig: body.stepConfig,
    errorMessage: body.errorMessage,
    stdout: body.stdout,
    stderr: body.stderr,
  };

  if (!body.runId || !body.stepId) return ctx;

  const run = await prisma.execution.findFirst({
    where: { id: body.runId, runbook: { tenantId } },
    include: {
      nodeLogs: { orderBy: { startedAt: 'asc' } },
      runbook: { select: { id: true, name: true } },
    },
  });
  if (!run) return ctx;

  const target = run.nodeLogs.find(l => l.nodeId === body.stepId || l.id === body.stepId);
  if (target) {
    ctx.stepName = target.nodeName ?? ctx.stepName;
    ctx.stepType = target.nodeType ?? ctx.stepType;
    ctx.errorMessage = ctx.errorMessage ?? target.error ?? undefined;
    const outputObj = (target.output as Record<string, unknown> | null) ?? null;
    if (outputObj) {
      if (typeof outputObj.stdout === 'string') ctx.stdout = ctx.stdout ?? outputObj.stdout;
      if (typeof outputObj.stderr === 'string') ctx.stderr = ctx.stderr ?? outputObj.stderr;
    }
  }

  // Last 5 step outputs as additional context (excluding the target).
  ctx.previousOutputs = run.nodeLogs
    .filter(l => l.id !== target?.id)
    .slice(-5)
    .map(l => ({ stepName: l.nodeName ?? l.nodeId, output: l.output }));

  return ctx;
}

function buildPrompt(context: ResolvedContext, question?: string): ModelMessage[] {
  const lines: string[] = [
    'A Operari runbook step has failed. Diagnose the most likely cause and suggest a concrete fix.',
    '',
    `Step: ${context.stepName}`,
    `Type: ${context.stepType}`,
  ];
  if (context.stepConfig && Object.keys(context.stepConfig).length > 0) {
    lines.push('Config:', '```json', JSON.stringify(context.stepConfig, null, 2), '```');
  }
  if (context.errorMessage) {
    lines.push('Error:', '```', context.errorMessage, '```');
  }
  if (context.stderr) {
    lines.push('Stderr (truncated to last 4 KB):', '```', context.stderr.slice(-4000), '```');
  }
  if (context.stdout) {
    lines.push('Stdout (truncated to last 2 KB):', '```', context.stdout.slice(-2000), '```');
  }
  if (context.previousOutputs && context.previousOutputs.length > 0) {
    lines.push('Recent prior step outputs:');
    for (const p of context.previousOutputs) {
      lines.push(`- ${p.stepName}: ${JSON.stringify(p.output ?? null).slice(0, 400)}`);
    }
  }
  lines.push(
    '',
    'Respond with: (1) one-sentence diagnosis, (2) likely root cause, (3) concrete next action the operator should take. Be terse.'
  );
  if (question && question.trim()) {
    lines.push('', `Operator question: ${question.trim()}`);
  }

  return [
    {
      role: 'user',
      content: lines.join('\n'),
    } as ModelMessage,
  ];
}

export default router;
