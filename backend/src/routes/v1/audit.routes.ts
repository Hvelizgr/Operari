import { Response, Router } from 'express';

import { AuditService } from '../../audit/audit.service';
import { buildDeletedActorSet, redactRow } from '../../audit/audit-redaction';
import { ApiKeyRequest, requireApiKey } from '../../middleware/api-key.middleware';
import { prisma } from '../../server';

const router = Router();

let auditService: AuditService | null = null;
function getService(): AuditService {
  if (!auditService) auditService = new AuditService(prisma);
  return auditService;
}

/**
 * GET /api/v1/audit/verify
 *
 * Walks the caller tenant's audit chain and reports whether the hash
 * sequence is intact. Used by `operari audit verify` and by compliance
 * automation that needs to prove tamper-evidence to an auditor.
 *
 * Query params:
 *   - fromSeq: optional bigint (as string) to start verification mid-chain
 *   - pageSize: optional, default 1000
 *
 * The tenantId is taken from the API key context — never from the request
 * body — so a tenant can only verify its own chain.
 *
 * Required scope: `audit:read`
 */
router.get('/verify', requireApiKey('audit:read'), async (req: ApiKeyRequest, res: Response) => {
  const { tenantId } = req.apiContext!;

  let fromSeq: bigint | undefined;
  if (typeof req.query.fromSeq === 'string') {
    try {
      fromSeq = BigInt(req.query.fromSeq);
      if (fromSeq < 0n) throw new Error('negative');
    } catch {
      return res.status(400).json({
        error: 'fromSeq must be a non-negative integer',
        code: 'invalid_fromSeq',
      });
    }
  }

  let pageSize: number | undefined;
  if (typeof req.query.pageSize === 'string') {
    const parsed = Number.parseInt(req.query.pageSize, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 10_000) {
      return res.status(400).json({
        error: 'pageSize must be an integer between 1 and 10000',
        code: 'invalid_pageSize',
      });
    }
    pageSize = parsed;
  }

  const status = await getService().verifyChain(tenantId, { fromSeq, pageSize });

  res.json({
    tenantId: status.tenantId,
    eventCount: status.eventCount,
    intact: status.firstBrokenSeq === null && status.firstGapAfterSeq === null,
    firstBrokenSeq: status.firstBrokenSeq?.toString() ?? null,
    firstGapAfterSeq: status.firstGapAfterSeq?.toString() ?? null,
    verifiedAt: new Date().toISOString(),
  });
});

/**
 * Plans that are allowed to export the audit log. Gated because
 * SIEM/compliance integration is sold as a BUSINESS+ feature (see
 * pricing page). FREE and TEAM tenants get a 402 with the pricing
 * CTA so the upgrade path is clear — the endpoint doesn't 403
 * because that would read as "your key is wrong" rather than
 * "your plan is wrong".
 */
const EXPORT_ALLOWED_PLANS = new Set(['BUSINESS', 'ENTERPRISE', 'PRO']);

/**
 * GET /api/v1/audit/export?fromSeq=<bigint>
 *
 * Streaming NDJSON download of the caller tenant's audit chain.
 * Every row is emitted as a single JSON line (bigints serialized as
 * string — JSON has no native bigint and SIEM parsers expect
 * strings for huge numbers anyway).
 *
 * Required scope: audit:read. Plan gate: BUSINESS / ENTERPRISE /
 * PRO. Self-audits with `audit.exported` once the stream finishes
 * so a reviewer can see "who pulled the chain and when". Supports
 * `fromSeq` for incremental pulls — SIEM pipelines pass the last
 * seen seq + 1 and only receive new rows.
 */
router.get('/export', requireApiKey('audit:read'), async (req: ApiKeyRequest, res: Response) => {
  const { tenantId, keyId } = req.apiContext!;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant || !EXPORT_ALLOWED_PLANS.has(tenant.plan)) {
    return res.status(402).json({
      error: 'Audit export requires the Business plan or higher.',
      code: 'plan_gate',
    });
  }

  let fromSeq: bigint | undefined;
  if (typeof req.query.fromSeq === 'string') {
    try {
      fromSeq = BigInt(req.query.fromSeq);
      if (fromSeq < 0n) throw new Error('negative');
    } catch {
      return res.status(400).json({
        error: 'fromSeq must be a non-negative integer',
        code: 'invalid_fromSeq',
      });
    }
  }

  const filename = `operari-audit-${tenantId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.ndjson`;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  // Flush the headers before the first row so download managers
  // can show progress + filename immediately.
  res.flushHeaders?.();

  // GDPR: mask any reference to a deleted user before bytes leave
  // the process. Built once per export by a cheap tombstone-filtered
  // scan; reused for every row.
  const deletedActors = await buildDeletedActorSet(getService(), tenantId);

  let count = 0;
  try {
    for await (const row of getService().streamEvents(tenantId, { fromSeq })) {
      const redacted = redactRow(row, deletedActors);
      const serialized = {
        ...redacted,
        seq: redacted.seq.toString(),
        createdAt:
          redacted.createdAt instanceof Date
            ? redacted.createdAt.toISOString()
            : redacted.createdAt,
      };
      res.write(JSON.stringify(serialized));
      res.write('\n');
      count++;
    }
  } catch (err) {
    // If the stream blows up mid-flight the headers are
    // already sent — we can't switch to a 500. Log it and
    // close the connection; the client sees a truncated file
    // and can retry with `fromSeq=<last known seq + 1>`.
    req.log?.error({ err, tenantId, count }, 'audit.export.stream_failed');
  }
  res.end();

  // Fire-and-forget self-audit once the stream drains.
  void getService()
    .record({
      tenantId,
      type: 'audit.exported',
      actorId: keyId,
      actorType: 'apikey',
      resource: tenantId,
      payload: {
        format: 'ndjson',
        count,
        fromSeq: fromSeq?.toString() ?? null,
      },
    })
    .catch(() => undefined);
});

export default router;
