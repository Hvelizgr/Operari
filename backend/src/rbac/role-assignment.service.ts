import type { PrismaClient } from '@prisma/client';

import type { ActorType, AuditService } from '../audit/audit.service';
import type { PermissionService } from './permission.service';

/**
 * RoleAssignmentService — the only sanctioned way to grant or revoke
 * a custom role in NanoRun.
 *
 * Three things must happen on every grant/revoke:
 *   1. The `RoleAssignment` row is created or deleted
 *   2. The PermissionService cache for that user is invalidated so the
 *      change takes effect on the next request, not 30 seconds later
 *   3. A `role.granted` / `role.revoked` event is appended to the
 *      tenant's audit chain
 *
 * Doing this in three places at every call site is how compliance gaps
 * happen. Centralize it. Future admin endpoints, CLI commands, and seed
 * scripts must call this service rather than touching `prisma.roleAssignment`
 * directly.
 *
 * Tenant safety: callers MUST pass the actor's tenantId. The service
 * verifies that the target user and the role both belong to that
 * tenant — granting a role across tenants is a hard error, not a silent
 * cross-tenant escalation.
 */

export interface GrantRoleInput {
  /** User receiving the role */
  userId: string;
  /** Role being granted */
  roleId: string;
  /** Tenant the operation is scoped to (must own user AND role) */
  tenantId: string;
  /** Who is performing the grant. `null` for system-initiated grants. */
  actorId?: string | null;
  actorType?: ActorType | null;
  /** Free-form reason recorded in the audit payload */
  reason?: string;
}

export interface RevokeRoleInput {
  userId: string;
  roleId: string;
  tenantId: string;
  actorId?: string | null;
  actorType?: ActorType | null;
  reason?: string;
}

export class RoleAssignmentError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'CROSS_TENANT' | 'ALREADY_ASSIGNED' | 'NOT_ASSIGNED'
  ) {
    super(message);
    this.name = 'RoleAssignmentError';
  }
}

export class RoleAssignmentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
    private readonly permissions: PermissionService
  ) {}

  /**
   * Grant a role to a user. Idempotent at the DB layer (`@@unique([userId, roleId])`)
   * but we throw `ALREADY_ASSIGNED` rather than silently no-op'ing so
   * the audit chain does not get spammed with duplicates.
   */
  async grant(input: GrantRoleInput): Promise<{ assignmentId: string }> {
    const { user, role } = await this.loadAndVerify(input.userId, input.roleId, input.tenantId);

    const existing = await this.prisma.roleAssignment.findUnique({
      where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
      select: { id: true },
    });
    if (existing) {
      throw new RoleAssignmentError(
        `User ${input.userId} already has role ${input.roleId}`,
        'ALREADY_ASSIGNED'
      );
    }

    const assignment = await this.prisma.roleAssignment.create({
      data: {
        userId: input.userId,
        roleId: input.roleId,
        grantedBy: input.actorId ?? null,
      },
      select: { id: true },
    });

    this.permissions.invalidate(input.userId);

    await this.recordSafe('role.granted', {
      tenantId: input.tenantId,
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? 'user',
      resource: `user:${input.userId}`,
      payload: {
        userId: input.userId,
        userEmail: user.email,
        roleId: input.roleId,
        roleName: role.name,
        assignmentId: assignment.id,
        reason: input.reason ?? null,
      },
    });

    return { assignmentId: assignment.id };
  }

  /**
   * Revoke a role from a user. Throws `NOT_ASSIGNED` if the assignment
   * does not exist — see grant() rationale.
   */
  async revoke(input: RevokeRoleInput): Promise<void> {
    const { user, role } = await this.loadAndVerify(input.userId, input.roleId, input.tenantId);

    const existing = await this.prisma.roleAssignment.findUnique({
      where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
      select: { id: true },
    });
    if (!existing) {
      throw new RoleAssignmentError(
        `User ${input.userId} does not have role ${input.roleId}`,
        'NOT_ASSIGNED'
      );
    }

    await this.prisma.roleAssignment.delete({
      where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
    });

    this.permissions.invalidate(input.userId);

    await this.recordSafe('role.revoked', {
      tenantId: input.tenantId,
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? 'user',
      resource: `user:${input.userId}`,
      payload: {
        userId: input.userId,
        userEmail: user.email,
        roleId: input.roleId,
        roleName: role.name,
        assignmentId: existing.id,
        reason: input.reason ?? null,
      },
    });
  }

  /**
   * Load both ends of the assignment, verify they exist, verify both
   * belong to the same tenant the caller claims. Cross-tenant grants
   * are never silent — they throw.
   */
  private async loadAndVerify(userId: string, roleId: string, tenantId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, tenantId: true },
      }),
      this.prisma.customRole.findUnique({
        where: { id: roleId },
        select: { id: true, name: true, tenantId: true },
      }),
    ]);

    if (!user) {
      throw new RoleAssignmentError(`User ${userId} not found`, 'NOT_FOUND');
    }
    if (!role) {
      throw new RoleAssignmentError(`Role ${roleId} not found`, 'NOT_FOUND');
    }
    if (user.tenantId !== tenantId || role.tenantId !== tenantId) {
      throw new RoleAssignmentError(
        `Cross-tenant role assignment refused (user.tenant=${user.tenantId}, role.tenant=${role.tenantId}, caller.tenant=${tenantId})`,
        'CROSS_TENANT'
      );
    }
    return { user, role };
  }

  /**
   * Best-effort audit write. The actual grant/revoke already happened
   * — losing the audit row is a verifier-detectable gap, not a reason
   * to undo a successful permission change.
   */
  private async recordSafe(
    type: 'role.granted' | 'role.revoked',
    params: {
      tenantId: string;
      actorId: string | null;
      actorType: ActorType;
      resource: string;
      payload: Record<string, unknown>;
    }
  ): Promise<void> {
    try {
      await this.audit.record({
        tenantId: params.tenantId,
        type,
        actorId: params.actorId,
        actorType: params.actorType,
        resource: params.resource,
        payload: params.payload,
      });
    } catch {
      // intentional
    }
  }
}
