import { generateObject } from 'ai';
import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, anonymousFallback } from '../middleware/auth.middleware';
import { prisma } from '../server';
import { resolveAiModel } from '../agent/models';

const router = Router();
router.use(anonymousFallback);

/**
 * Trigger.dev parity: a natural-language → filter-params endpoint
 * for the runs list. The operator types "tasks that failed yesterday
 * in prod" and the LLM emits `{ status: 'FAILED', from, to, runbook? }`,
 * which the frontend appends to the query string of the existing
 * GET /api/runs endpoint.
 *
 * Why a dedicated endpoint (not a tool call from the orchestrator):
 *   - The orchestrator is meant for conversational debugging
 *     ("explain why this run failed"). Filtering is a one-shot.
 *   - The output is a small structured object — `generateObject`
 *     with a zod schema is ~10x cheaper in tokens than full chat.
 *   - The endpoint is tenant-scoped at the auth boundary; we don't
 *     want filter generation to leak runs across tenants.
 */

const filtersSchema = z.object({
  status: z
    .enum(['RUNNING', 'SUCCESS', 'FAILED', 'PAUSED', 'CANCELLED'])
    .nullish()
    .describe('Single status filter; null when the user wants all statuses'),
  runbook: z
    .string()
    .nullish()
    .describe(
      'Runbook id or slug to scope the query — only set when the user named a specific runbook'
    ),
  from: z.string().nullish().describe('ISO-8601 lower bound on startedAt (inclusive)'),
  to: z.string().nullish().describe('ISO-8601 upper bound on startedAt (exclusive)'),
});

type Filters = z.infer<typeof filtersSchema>;

interface SuccessShape {
  success: true;
  filters: Filters;
  explanation?: string;
}
interface FailureShape {
  success: false;
  error: string;
  suggestions?: string[];
}

/**
 * Pull the canonical runbook list for THIS tenant so the prompt can
 * resolve "deploy frontend" → the actual slug. Bounded at 50 to keep
 * the prompt below token budgets — real installs with thousands of
 * runbooks would need a vector lookup, but the 50-row sweep is cheap
 * and matches the SRE persona who works on a tight set of runbooks.
 */
async function listRunbookHints(
  tenantId: string
): Promise<Array<{ id: string; slug: string | null; name: string }>> {
  return prisma.runbook.findMany({
    where: { tenantId },
    select: { id: true, slug: true, name: true },
    take: 50,
    orderBy: { updatedAt: 'desc' },
  });
}

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const text = (req.body?.text ?? '').toString().trim();
  if (!text) {
    return res
      .status(400)
      .json({ success: false, error: 'Empty filter prompt' } satisfies FailureShape);
  }
  if (text.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Filter prompt is too long (max 500 chars)',
    } satisfies FailureShape);
  }

  let runbookHints: Array<{ id: string; slug: string | null; name: string }>;
  try {
    runbookHints = await listRunbookHints(req.user.tenantId);
  } catch (err) {
    req.log.error({ err }, 'AI filter: runbook hint lookup failed');
    runbookHints = [];
  }

  const now = new Date();
  const systemPrompt = [
    'You translate a SRE operator’s English (or Spanish) sentence into a filter spec for the Operari runs list.',
    'Return ONLY the structured filters object — no prose.',
    `The current time is ${now.toISOString()}. Reason about relative dates ("yesterday", "this week") in UTC.`,
    `Status MUST be one of RUNNING / SUCCESS / FAILED / PAUSED / CANCELLED, or null for "all".`,
    'Return null for any field the operator did not constrain. Do not invent.',
    runbookHints.length > 0
      ? `Available runbooks (id · slug · name):\n${runbookHints
          .map(r => `- ${r.id} · ${r.slug ?? '—'} · ${r.name}`)
          .join('\n')}`
      : 'No runbooks are listed for this tenant; only set "runbook" if the operator typed a slug or id verbatim.',
  ].join('\n\n');

  try {
    // The AI SDK's `generateObject` overload + a zod schema with
    // four `.nullish()` fields hits TS2589 ("type instantiation
    // excessively deep") on tsc 5.x. The runtime contract is the
    // same; cast to `unknown` and re-validate with the schema we
    // already declared. Belt + braces: one boundary cast keeps the
    // route handler typed while letting tsc finish.
    const { object } = (await generateObject({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: resolveAiModel() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema: filtersSchema as any,
      prompt: text,
      system: systemPrompt,
      // 8s budget — the request runs synchronously in the route,
      // so a stuck model call would block the page. The fetch the
      // frontend issues is non-critical (search box) so a timeout
      // surfaces as "couldn't parse, try again".
      abortSignal: AbortSignal.timeout(8_000),
    })) as { object: unknown };
    const parsed = filtersSchema.safeParse(object);
    if (!parsed.success) {
      return res.json({
        success: false,
        error: 'Model returned a malformed filter object',
      } satisfies FailureShape);
    }
    return res.json({
      success: true,
      filters: parsed.data,
    } satisfies SuccessShape);
  } catch (err) {
    req.log.error({ err }, 'AI filter: generateObject failed');
    return res.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      suggestions: [
        'tasks that failed today',
        'last 5 successful runs of deploy-frontend',
        'paused runs from this week',
      ],
    } satisfies FailureShape);
  }
});

export default router;
