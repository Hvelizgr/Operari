import { prisma } from '../server';
import { logger } from '../config/logger.config';
import { auditService, AuditAction } from './audit.service';
import { notificationService, NotificationPriority, NotificationChannel } from './notification.service';
import { ApprovalStatus, ApprovalType, Role } from '@prisma/client';

export interface CreateApprovalRequestInput {
    workflowId: string;
    requesterId: string;
    tenantId: string;
    requestType: ApprovalType;
    comment?: string;
}

export interface ReviewApprovalRequestInput {
    approvalId: string;
    reviewerId: string;
    tenantId: string;
    status: ApprovalStatus;
    reviewerComment?: string;
}

export class ApprovalService {
    private static instance: ApprovalService;

    private constructor() {}

    public static getInstance(): ApprovalService {
        if (!ApprovalService.instance) {
            ApprovalService.instance = new ApprovalService();
        }
        return ApprovalService.instance;
    }

    /**
     * Create a new approval request for a workflow
     */
    public async createRequest(input: CreateApprovalRequestInput) {
        const { workflowId, requesterId, tenantId, requestType, comment } = input;

        // Check if there is already a pending request for this workflow
        const existingPending = await prisma.workflowApproval.findFirst({
            where: {
                workflowId,
                status: ApprovalStatus.PENDING,
                requestType,
            }
        });

        if (existingPending) {
            throw new Error('There is already a pending approval request for this workflow');
        }

        const approval = await prisma.workflowApproval.create({
            data: {
                workflowId,
                requesterId,
                requestType,
                comment,
                status: ApprovalStatus.PENDING,
            },
            include: {
                workflow: true,
                requester: {
                    select: { name: true, email: true }
                }
            }
        });

        // Log audit event
        await auditService.log({
            tenantId,
            userId: requesterId,
            action: AuditAction.APPROVAL_REQUEST,
            resourceType: 'WORKFLOW',
            resourceId: workflowId,
            details: { approvalId: approval.id, requestType }
        });

        // Notify admins/reviewers
        await this.notifyReviewers(tenantId, approval);

        return approval;
    }

    /**
     * Review (Approve or Reject) an approval request
     */
    public async reviewRequest(input: ReviewApprovalRequestInput) {
        const { approvalId, reviewerId, tenantId, status, reviewerComment } = input;

        const approval = await prisma.workflowApproval.findUnique({
            where: { id: approvalId },
            include: { workflow: true }
        });

        if (!approval) {
            throw new Error('Approval request not found');
        }

        if (approval.status !== ApprovalStatus.PENDING) {
            throw new Error('This request has already been reviewed');
        }

        const updatedApproval = await prisma.workflowApproval.update({
            where: { id: approvalId },
            data: {
                reviewerId,
                status,
                reviewerComment,
            },
            include: {
                workflow: true,
                requester: {
                    select: { name: true, email: true }
                },
                reviewer: {
                    select: { name: true, email: true }
                }
            }
        });

        // If approved, perform the requested action
        if (status === ApprovalStatus.APPROVED) {
            if (approval.requestType === ApprovalType.ACTIVATION) {
                await this.handleActivationApproval(approval.workflowId, tenantId);
            }
            // Add DEPLOYMENT type handling here if needed
        }

        // Log audit event
        await auditService.log({
            tenantId,
            userId: reviewerId,
            action: AuditAction.APPROVAL_REVIEW,
            resourceType: 'WORKFLOW',
            resourceId: approval.workflowId,
            details: { approvalId, status, reviewerComment }
        });

        // Notify requester
        await this.notifyRequester(tenantId, updatedApproval);

        return updatedApproval;
    }

    /**
     * Handle workflow activation after approval
     */
    private async handleActivationApproval(workflowId: string, _tenantId: string) {
        try {
            // Check if it's an n8n workflow
            const workflow = await prisma.workflow.findUnique({
                where: { id: workflowId }
            });

            if (workflow && workflow.isActive === false) {
                // Activate workflow in DB
                await prisma.workflow.update({
                    where: { id: workflowId },
                    data: { isActive: true }
                });

                // Activate scheduled job if exists
                await prisma.scheduledJob.updateMany({
                    where: { workflowId },
                    data: { isActive: true }
                });

                // If it has a schedule, we might need to tell the SchedulerService to start it
                // For now, we assume the SchedulerService will pick it up on next poll or via a separate mechanism
                // In a production environment, we'd emit an event or call SchedulerService.scheduleJob directly
                
                logger.info({ workflowId }, 'Workflow and its scheduled jobs auto-activated after approval');
            }
        } catch (error) {
            logger.error({ error, workflowId }, 'Failed to auto-activate workflow after approval');
        }
    }

    /**
     * Get pending approval requests for a tenant
     */
    public async getPendingRequests(tenantId: string) {
        return prisma.workflowApproval.findMany({
            where: {
                workflow: { tenantId },
                status: ApprovalStatus.PENDING,
            },
            include: {
                workflow: {
                    select: { name: true, description: true }
                },
                requester: {
                    select: { name: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Check if a workflow requires approval for activation
     */
    public async requiresApproval(workflowId: string): Promise<boolean> {
        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId },
            select: { requiresApproval: true }
        });
        return workflow?.requiresApproval || false;
    }

    /**
     * Notify reviewers about a new request
     */
    private async notifyReviewers(tenantId: string, approval: any) {
        // Find admins/reviewers in the tenant
        const reviewers = await prisma.user.findMany({
            where: {
                tenantId,
                role: Role.ADMIN // Or a specific REVIEWER role if added
            }
        });

        for (const reviewer of reviewers) {
            await notificationService.send({
                tenantId,
                userId: reviewer.id,
                title: 'New Approval Request',
                message: `User ${approval.requester.name || approval.requester.email} requested ${approval.requestType} for workflow "${approval.workflow.name}".`,
                priority: NotificationPriority.HIGH,
                channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                actionUrl: `${process.env.FRONTEND_URL}/admin/approvals/${approval.id}`
            });
        }
    }

    /**
     * Notify requester about review results
     */
    private async notifyRequester(tenantId: string, approval: any) {
        await notificationService.send({
            tenantId,
            userId: approval.requesterId,
            title: `Approval Request ${approval.status}`,
            message: `Your request for ${approval.requestType} for workflow "${approval.workflow.name}" has been ${approval.status.toLowerCase()}. ${approval.reviewerComment ? `Comment: ${approval.reviewerComment}` : ''}`,
            priority: approval.status === ApprovalStatus.APPROVED ? NotificationPriority.MEDIUM : NotificationPriority.HIGH,
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            actionUrl: `${process.env.FRONTEND_URL}/workflows/${approval.workflowId}`
        });
    }
}

export const approvalService = ApprovalService.getInstance();
