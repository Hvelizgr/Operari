import type { PrismaClient, Server } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { type TenantPolicy, tenantPolicyStore } from '../policy/tenant-policy';
import { ConnectedAccountService } from '../security/connected-account.service';
import { SecretCipher } from '../security/secret-cipher';
import { SecretReader } from '../security/secret-reader';
import { type IssuedCertificate, SshCertificateService } from './ssh-ca';

export type ServerRecord = Pick<
  Server,
  | 'id'
  | 'tenantId'
  | 'name'
  | 'host'
  | 'port'
  | 'username'
  | 'hostKey'
  | 'hostKeyFingerprint'
  | 'authMode'
  | 'credentialId'
  | 'sudoAllowed'
>;

export interface StepRef {
  tenantId: string;
  runId: string;
  stepId: string;
}

/**
 * What the ssh step needs from the database, behind one interface so the
 * executor stays testable. Every credential read is audited
 * (`secret.accessed`) by ConnectedAccountService.
 */
export interface ServerDirectory {
  get(tenantId: string, serverId: string): Promise<ServerRecord | null>;
  privateKey(server: ServerRecord, ref: StepRef): Promise<string>;
  certificate(server: ServerRecord, ref: StepRef): Promise<IssuedCertificate>;
  policy(tenantId: string): Promise<TenantPolicy>;
  /** Distinct users who approved a step of this run. */
  approvers(runId: string): Promise<string[]>;
  record(ref: StepRef, type: 'ssh.privileged', payload: Record<string, unknown>): Promise<void>;
}

export class PrismaServerDirectory implements ServerDirectory {
  private accounts: ConnectedAccountService | null = null;
  private certs: SshCertificateService | null = null;
  private readonly audit: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
  }

  private cipher(): SecretCipher {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 32) throw new Error('ENCRYPTION_KEY is not configured');
    return new SecretCipher(key);
  }

  private accountService(): ConnectedAccountService {
    if (!this.accounts) {
      const cipher = this.cipher();
      this.accounts = new ConnectedAccountService(
        this.prisma,
        cipher,
        new SecretReader(cipher, this.audit),
        this.audit
      );
    }
    return this.accounts;
  }

  certificateService(): SshCertificateService {
    if (!this.certs) this.certs = new SshCertificateService(this.prisma, this.cipher());
    return this.certs;
  }

  get(tenantId: string, serverId: string): Promise<ServerRecord | null> {
    return this.prisma.server.findFirst({ where: { id: serverId, tenantId } });
  }

  async privateKey(server: ServerRecord, ref: StepRef): Promise<string> {
    if (!server.credentialId) throw new Error(`server "${server.name}" has no credential`);
    return this.accountService().getAccessToken({
      accountId: server.credentialId,
      tenantId: ref.tenantId,
      actorType: 'system',
      actorId: `run:${ref.runId}`,
      reason: `runbook-step:${ref.stepId}`,
    });
  }

  certificate(server: ServerRecord, ref: StepRef): Promise<IssuedCertificate> {
    return this.certificateService().issue(
      ref.tenantId,
      server.username,
      `operari:${ref.tenantId}:${ref.runId}:${ref.stepId}`
    );
  }

  policy(tenantId: string): Promise<TenantPolicy> {
    return tenantPolicyStore(this.prisma).get(tenantId);
  }

  async approvers(runId: string): Promise<string[]> {
    const rows = await this.prisma.approval.findMany({
      where: { executionId: runId, status: 'APPROVED', approvedBy: { not: null } },
      select: { approvedBy: true },
    });
    return Array.from(new Set(rows.map(r => r.approvedBy as string)));
  }

  async record(
    ref: StepRef,
    type: 'ssh.privileged',
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.audit.record({
      tenantId: ref.tenantId,
      type,
      actorId: `run:${ref.runId}`,
      actorType: 'system',
      resource: `step:${ref.stepId}`,
      payload,
    });
  }
}
