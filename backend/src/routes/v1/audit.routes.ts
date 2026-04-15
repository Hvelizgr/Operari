import { Router, Response } from 'express';
import { prisma } from '../../server';
import { requireApiKey, ApiKeyRequest } from '../../middleware/api-key.middleware';
import { AuditService } from '../../audit/audit.service';

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
 * sequence is intact. Used by `nanorun audit verify` and by compliance
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
router.get(
    '/verify',
    requireApiKey('audit:read'),
    async (req: ApiKeyRequest, res: Response) => {
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
    },
);

export default router;
