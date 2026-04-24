import { createHash } from 'crypto';

import type { AuditService } from './audit.service';

/**
 * GDPR-aware audit export redaction.
 *
 * Context: AuditEvent is immutable by design — a postgres trigger
 * blocks UPDATE + DELETE + TRUNCATE so the hash chain stays
 * tamper-evident. That contract is good for compliance but creates a
 * tension with Article 17 (right to be forgotten): a deleted user's
 * email + name + id still sit in every payload that referenced them.
 *
 * Resolution: don't touch storage — redact on EXPORT. The chain stays
 * verifiable in place (auditors inspect the row as stored), but any
 * `/audit/export` stream runs every row through `redactRow()` first.
 * A deleted user's id becomes `<deleted-user-{hash8}>`; strings in the
 * payload that match a deleted id get the same masked token. Live
 * actorIds pass through unchanged.
 *
 * Why a short deterministic hash instead of a flat `<deleted>`:
 * compliance reviewers often need to answer "was it the same user
 * across these three events?". The sha256 prefix preserves that
 * join-ability without exposing the original id.
 *
 * Contract notes:
 * - The deleted set is BUILT ONCE per export (one `streamEvents` pass
 *   filtered to `user.deleted`), then reused for every streaming
 *   row. O(N) extra reads at export time; zero cost on the chain
 *   append path.
 * - We only mask strings whose VALUE matches a deleted id. Keys like
 *   `email` or `name` are left alone unless their value happens to
 *   be a deleted id — because most audit rows carry the *actor's*
 *   email (the one performing the action), not the target's, and
 *   blindly masking every `email` field would strip context from
 *   rows that had nothing to do with the deleted user.
 * - `user.deleted` / `tenant.deleted` tombstones themselves pass
 *   through as-is — they are the legal proof the deletion happened,
 *   and their payload carries the deletion timestamp operators need.
 */

const TOMBSTONE_TYPES: ReadonlySet<string> = new Set(['user.deleted', 'tenant.deleted']);

/**
 * Walk every `user.deleted` audit event for this tenant and collect
 * the deleted user ids. The streamEvents filter pushes the scan down
 * to Postgres so even a tenant with millions of rows only reads the
 * handful of tombstones.
 */
export async function buildDeletedActorSet(
  audit: AuditService,
  tenantId: string
): Promise<Set<string>> {
  const deleted = new Set<string>();
  for await (const row of audit.streamEvents(tenantId, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    types: ['user.deleted' as any],
  })) {
    if (row.actorId) deleted.add(row.actorId);
    // Some tombstone payloads carry the deleted id in a `deletedUserId`
    // field (account-deletion.service writes both). Harvest it so the
    // mask matches regardless of which flavor landed.
    const payload = row.payload;
    if (payload && typeof payload === 'object') {
      const maybeId = (payload as Record<string, unknown>).deletedUserId;
      if (typeof maybeId === 'string') deleted.add(maybeId);
    }
  }
  return deleted;
}

/**
 * Stable 8-char hex prefix of sha256(id). Same input → same output,
 * so a reviewer can still correlate multiple events that reference
 * the same deleted user. The original id is not recoverable.
 */
export function maskDeletedId(id: string): string {
  const h = createHash('sha256').update(id).digest('hex').slice(0, 8);
  return `<deleted-user-${h}>`;
}

export interface AuditExportRow {
  id: string;
  seq: bigint;
  type: string;
  actorId: string | null;
  actorType: string | null;
  resource: string | null;
  payload: unknown;
  hash: string;
  prevHash: string;
  createdAt: Date;
}

/**
 * Return a new row (never mutates the argument) with deleted-user
 * references masked. Tombstone rows are returned untouched — operators
 * and auditors need the original data to prove WHEN the deletion
 * happened.
 */
export function redactRow(row: AuditExportRow, deleted: Set<string>): AuditExportRow {
  if (deleted.size === 0) return row;
  if (TOMBSTONE_TYPES.has(row.type)) return row;

  const maskedActorId =
    row.actorId && deleted.has(row.actorId) ? maskDeletedId(row.actorId) : row.actorId;
  const maskedResource =
    row.resource && deleted.has(row.resource) ? maskDeletedId(row.resource) : row.resource;
  const maskedPayload = redactPayload(row.payload, deleted);

  return {
    ...row,
    actorId: maskedActorId,
    resource: maskedResource,
    payload: maskedPayload,
  };
}

/**
 * Recursively walk the payload JSON and replace any string whose
 * entire value matches a deleted id. Non-matching strings, numbers,
 * and booleans pass through.
 */
export function redactPayload(value: unknown, deleted: Set<string>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return deleted.has(value) ? maskDeletedId(value) : value;
  }
  if (Array.isArray(value)) {
    return value.map(v => redactPayload(v, deleted));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactPayload(v, deleted);
    }
    return out;
  }
  return value;
}
