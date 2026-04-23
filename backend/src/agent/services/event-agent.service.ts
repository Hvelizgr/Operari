import { Prisma, PrismaClient } from '@prisma/client';
import { JSONPath } from 'jsonpath-plus';

import { logger } from '../../config/logger.config';

/**
 * EventAgentService — orchestrates the "webhook event → matching agent →
 * runbook trigger" pipeline that powers the Agents surface.
 *
 * Three responsibilities, kept in one file because they share the
 * matcher contract:
 *
 *   1. CRUD over EventAgent rows (called by /api/event-agents routes)
 *   2. match(agent, payload)  → pure function, used by /test and the
 *      hot path inside processWebhookEvent
 *   3. processWebhookEvent(webhookId, payload, executionService) →
 *      called by webhook.routes.ts after the webhook's own bound
 *      runbook has been triggered. Fans out to every enabled agent
 *      for that webhook, evaluates the matcher, applies var mapping,
 *      triggers the target runbook, and records an EventAgentExecution
 *      row regardless of outcome (matched or not). The full audit
 *      trail of "why didn't this agent fire" is the point.
 */

export type MatcherType = 'jsonpath' | 'llm' | 'always';

export interface JsonPathRule {
  /** JSONPath expression that must resolve to a non-empty value. */
  path: string;
  /** Optional value the path's result must equal (loose ===). */
  equals?: unknown;
  /** Optional substring the path's result must contain (string only). */
  contains?: string;
}

export interface JsonPathMatcherConfig {
  /** All rules must hold (AND). Empty array → always match. */
  rules: JsonPathRule[];
}

export interface LlmMatcherConfig {
  /** Free-form prompt describing when to match. */
  prompt: string;
}

export interface MatchResult {
  matched: boolean;
  /** Human-readable reason — surfaced in EventAgentExecution.reason. */
  reason: string;
  /** Extracted variables for the runbook trigger (only valid if matched). */
  vars: Record<string, unknown>;
}

export interface EventAgentInput {
  name: string;
  description?: string | null;
  source: string;
  webhookId?: string | null;
  matcherType: MatcherType;
  matcherConfig: Prisma.InputJsonValue;
  targetRunbookId: string;
  varMapping: Prisma.InputJsonValue;
  isEnabled?: boolean;
  rateLimitPerHour?: number;
}

export class EventAgentService {
  constructor(private prisma: PrismaClient) {}

  // ────────────────────────────────────────────────────────────
  // CRUD
  // ────────────────────────────────────────────────────────────

  list(tenantId: string) {
    return this.prisma.eventAgent.findMany({
      where: { tenantId },
      include: {
        targetRunbook: { select: { id: true, slug: true, name: true } },
        webhook: { select: { id: true, source: true, token: true } },
        _count: { select: { executions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.eventAgent.findFirst({
      where: { id, tenantId },
      include: {
        targetRunbook: { select: { id: true, slug: true, name: true } },
        webhook: { select: { id: true, source: true, token: true } },
      },
    });
  }

  async create(tenantId: string, input: EventAgentInput) {
    // Verify the runbook belongs to the tenant — never let cross-tenant
    // wiring slip in via a hand-crafted POST.
    const runbook = await this.prisma.runbook.findFirst({
      where: { id: input.targetRunbookId, tenantId },
      select: { id: true },
    });
    if (!runbook) {
      throw new Error('targetRunbookId does not belong to this tenant');
    }
    if (input.webhookId) {
      const webhook = await this.prisma.webhook.findFirst({
        where: { id: input.webhookId, tenantId },
        select: { id: true },
      });
      if (!webhook) {
        throw new Error('webhookId does not belong to this tenant');
      }
    }
    return this.prisma.eventAgent.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description ?? null,
        source: input.source,
        webhookId: input.webhookId ?? null,
        matcherType: input.matcherType,
        matcherConfig: input.matcherConfig,
        targetRunbookId: input.targetRunbookId,
        varMapping: input.varMapping,
        isEnabled: input.isEnabled ?? true,
        rateLimitPerHour: input.rateLimitPerHour ?? 10,
      },
    });
  }

  async update(tenantId: string, id: string, input: Partial<EventAgentInput>) {
    const existing = await this.prisma.eventAgent.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return null;
    if (input.targetRunbookId) {
      const runbook = await this.prisma.runbook.findFirst({
        where: { id: input.targetRunbookId, tenantId },
        select: { id: true },
      });
      if (!runbook) {
        throw new Error('targetRunbookId does not belong to this tenant');
      }
    }
    return this.prisma.eventAgent.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.source !== undefined && { source: input.source }),
        ...(input.webhookId !== undefined && { webhookId: input.webhookId }),
        ...(input.matcherType !== undefined && { matcherType: input.matcherType }),
        ...(input.matcherConfig !== undefined && {
          matcherConfig: input.matcherConfig,
        }),
        ...(input.targetRunbookId !== undefined && {
          targetRunbookId: input.targetRunbookId,
        }),
        ...(input.varMapping !== undefined && { varMapping: input.varMapping }),
        ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
        ...(input.rateLimitPerHour !== undefined && {
          rateLimitPerHour: input.rateLimitPerHour,
        }),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.prisma.eventAgent.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return null;
    await this.prisma.eventAgent.delete({ where: { id } });
    return existing;
  }

  listExecutions(tenantId: string, agentId: string, limit = 50) {
    return this.prisma.eventAgentExecution.findMany({
      where: { agentId, agent: { tenantId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ────────────────────────────────────────────────────────────
  // Matching
  // ────────────────────────────────────────────────────────────

  /**
   * Pure matcher — no DB writes, no side effects. Used by both the
   * hot path and the /test endpoint so the UI's "test this agent"
   * button is guaranteed to behave identically to a real event.
   */
  match(
    matcherType: MatcherType,
    matcherConfig: unknown,
    varMapping: unknown,
    payload: unknown
  ): MatchResult {
    try {
      const matched = this.evaluateMatcher(matcherType, matcherConfig, payload);
      if (!matched.matched) {
        return { matched: false, reason: matched.reason, vars: {} };
      }
      const vars = this.extractVars(varMapping, payload);
      return { matched: true, reason: matched.reason, vars };
    } catch (err) {
      return {
        matched: false,
        reason: `matcher_error: ${err instanceof Error ? err.message : String(err)}`,
        vars: {},
      };
    }
  }

  private evaluateMatcher(
    matcherType: MatcherType,
    matcherConfig: unknown,
    payload: unknown
  ): { matched: boolean; reason: string } {
    if (matcherType === 'always') {
      return { matched: true, reason: 'always' };
    }
    if (matcherType === 'jsonpath') {
      const cfg = (matcherConfig ?? {}) as JsonPathMatcherConfig;
      const rules = Array.isArray(cfg.rules) ? cfg.rules : [];
      if (rules.length === 0) {
        return { matched: true, reason: 'jsonpath:empty_rules' };
      }
      for (const rule of rules) {
        const result = JSONPath({ path: rule.path, json: payload as object });
        if (!Array.isArray(result) || result.length === 0) {
          return {
            matched: false,
            reason: `jsonpath:no_match path=${rule.path}`,
          };
        }
        const value = result[0];
        if (rule.equals !== undefined && value !== rule.equals) {
          return {
            matched: false,
            reason: `jsonpath:not_equals path=${rule.path} got=${JSON.stringify(value)}`,
          };
        }
        if (rule.contains !== undefined) {
          const str = typeof value === 'string' ? value : JSON.stringify(value);
          if (!str.includes(rule.contains)) {
            return {
              matched: false,
              reason: `jsonpath:not_contains path=${rule.path}`,
            };
          }
        }
      }
      return { matched: true, reason: 'jsonpath:all_rules_passed' };
    }
    if (matcherType === 'llm') {
      // LLM matchers are intentionally not yet wired into the hot
      // path — they need a budget guard and a circuit breaker so
      // a malformed agent cannot fan out to expensive model calls
      // on every webhook event. The /test endpoint can still call
      // it interactively. For now, treat live LLM matches as a
      // soft no-match with a clear reason so the operator sees it.
      return {
        matched: false,
        reason: 'llm_matcher_not_yet_wired_in_hot_path',
      };
    }
    return { matched: false, reason: `unknown_matcher_type:${matcherType}` };
  }

  private extractVars(varMapping: unknown, payload: unknown): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!varMapping || typeof varMapping !== 'object') return out;
    for (const [key, expr] of Object.entries(varMapping as Record<string, unknown>)) {
      if (typeof expr !== 'string') continue;
      try {
        const result = JSONPath({ path: expr, json: payload as object });
        if (Array.isArray(result) && result.length > 0) {
          out[key] = result.length === 1 ? result[0] : result;
        }
      } catch {
        // Skip silently — bad jsonpath shouldn't break the trigger.
      }
    }
    return out;
  }

  // ────────────────────────────────────────────────────────────
  // Hot path: process an inbound webhook event
  // ────────────────────────────────────────────────────────────

  /**
   * Find every enabled EventAgent bound to this webhook, evaluate it
   * against the payload, and if matched (and within rate limit),
   * trigger the agent's target runbook. Persists one
   * EventAgentExecution row per agent per inbound event — that is
   * the audit trail.
   *
   * The webhook receiver also triggers the webhook's own bound
   * runbook independently; this fan-out is *additive*, not a
   * replacement, so existing single-runbook webhooks keep working.
   */
  async processWebhookEvent(
    webhookId: string,
    payload: unknown,
    triggerRunbook: (workflowId: string, vars: Record<string, unknown>) => Promise<{ id: string }>
  ): Promise<void> {
    const agents = await this.prisma.eventAgent.findMany({
      where: { webhookId, isEnabled: true },
    });
    if (agents.length === 0) return;

    for (const agent of agents) {
      const result = this.match(
        agent.matcherType as MatcherType,
        agent.matcherConfig,
        agent.varMapping,
        payload
      );

      // Rate limit check (cheap: count executions in the last hour).
      let triggeredRunId: string | null = null;
      let finalReason = result.reason;
      let didMatch = result.matched;

      if (didMatch) {
        const since = new Date(Date.now() - 60 * 60 * 1000);
        const recentTriggers = await this.prisma.eventAgentExecution.count({
          where: {
            agentId: agent.id,
            matched: true,
            triggeredRunId: { not: null },
            createdAt: { gte: since },
          },
        });
        if (recentTriggers >= agent.rateLimitPerHour) {
          didMatch = false;
          finalReason = `rate_limited:${recentTriggers}/${agent.rateLimitPerHour}_per_hour`;
        } else {
          try {
            const run = await triggerRunbook(agent.targetRunbookId, result.vars);
            triggeredRunId = run.id;
            await this.prisma.eventAgent.update({
              where: { id: agent.id },
              data: {
                triggerCount: { increment: 1 },
                matchCount: { increment: 1 },
                lastTriggeredAt: new Date(),
              },
            });
          } catch (err) {
            didMatch = false;
            finalReason = `trigger_error:${err instanceof Error ? err.message : String(err)}`;
            logger.error({ agentId: agent.id, err }, 'EventAgent triggerRunbook failed');
          }
        }
      }

      await this.prisma.eventAgentExecution.create({
        data: {
          agentId: agent.id,
          payload: payload as Prisma.InputJsonValue,
          matched: didMatch,
          reason: finalReason,
          triggeredRunId,
        },
      });
    }
  }
}
