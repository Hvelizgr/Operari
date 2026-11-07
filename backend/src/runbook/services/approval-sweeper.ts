import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { logger } from '../../config/logger.config';
import { secretCipherFromEnv } from '../../security/secret-cipher';
import { ApprovalService } from './approval.service';
import { announceApproval, ApprovalNotifier, ApprovalTargets } from './approval-notifier';

const BATCH = 100;
export const TARGETS_AAD = 'approval.notifyTargets';

/**
 * Expires and escalates pending approvals. Both moves claim the row with a
 * conditional update, so several backends can sweep at once.
 */
export class ApprovalSweeper {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly approvals: ApprovalService,
    private readonly notifier: ApprovalNotifier = new ApprovalNotifier(),
    private readonly audit: AuditService | null = new AuditService(prisma)
  ) {}

  async runOnce(now: Date = new Date()): Promise<void> {
    const expired = await this.prisma.approval.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      select: { id: true },
      take: BATCH,
    });
    for (const { id } of expired) {
      await this.approvals.expire(id).catch(err => {
        logger.error({ err, approvalId: id }, 'Approval expiry failed');
      });
    }

    const due = await this.prisma.approval.findMany({
      where: { status: 'PENDING', escalateAt: { lte: now }, escalatedAt: null },
      include: { runbook: { select: { name: true, tenantId: true } } },
      take: BATCH,
    });
    for (const approval of due) {
      const claim = await this.prisma.approval.updateMany({
        where: { id: approval.id, status: 'PENDING', escalatedAt: null },
        data: { escalatedAt: now },
      });
      if (claim.count === 0) continue;

      const tenantId = approval.runbook.tenantId ?? undefined;
      const stored = readTargets(approval.notifyTargets, tenantId);
      await announceApproval({
        notifier: this.notifier,
        audit: this.audit,
        notice: {
          approvalId: approval.id,
          runbookName: approval.runbook.name,
          message: approval.message ?? '',
          escalated: true,
        },
        targets: {
          ...stored,
          emails: Array.from(new Set([...stored.emails, ...approval.escalateTo])),
        },
        tenantId,
        executionId: approval.executionId,
      });
    }
  }
}

function readTargets(payload: string | null, tenantId?: string): ApprovalTargets {
  if (!payload || !tenantId) return { emails: [] };
  try {
    const json = secretCipherFromEnv().decryptForTenant(payload, tenantId, TARGETS_AAD);
    return JSON.parse(json) as ApprovalTargets;
  } catch (err) {
    logger.error({ err }, 'Could not read stored approval targets');
    return { emails: [] };
  }
}

export function sealTargets(targets: ApprovalTargets, tenantId: string): string | null {
  try {
    return secretCipherFromEnv().encryptForTenant(JSON.stringify(targets), tenantId, TARGETS_AAD);
  } catch (err) {
    logger.error({ err }, 'Could not store approval targets; escalation will only email');
    return null;
  }
}
