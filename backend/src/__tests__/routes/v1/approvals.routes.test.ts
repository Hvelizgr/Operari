import express from 'express';
import request from 'supertest';

jest.mock('../../../server', () => ({
    prisma: {
        approval: {
            findMany: jest.fn(),
        },
    },
}));

jest.mock('../../../middleware/api-key.middleware', () => ({
    requireApiKey: (_scope?: string) => (req: any, _res: any, next: any) => {
        req.apiContext = (global as any).__fakeApiContext ?? {
            keyId: 'k-1',
            tenantId: 'tenant-1',
            scopes: ['approvals:resolve', 'approvals:read'],
        };
        next();
    },
}));

const resolveMock = jest.fn();
jest.mock('../../../runbook/services/approval.service', () => {
    const actual = jest.requireActual('../../../runbook/services/approval.service');
    return {
        ...actual,
        ApprovalService: jest.fn().mockImplementation(() => ({
            resolve: resolveMock,
        })),
    };
});

jest.mock('../../../editor/execution/execution.service', () => ({
    ExecutionService: jest.fn().mockImplementation(() => ({
        resumeExecution: jest.fn(),
    })),
}));

import approvalsRouter from '../../../routes/v1/approvals.routes';
import { ApprovalServiceError } from '../../../runbook/services/approval.service';
import { prisma as mockedPrisma } from '../../../server';
const findManyMock = (mockedPrisma as unknown as { approval: { findMany: jest.Mock } }).approval.findMany;

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/approvals', approvalsRouter);
    return app;
};

describe('GET /api/v1/approvals (list)', () => {
    beforeEach(() => {
        findManyMock.mockReset();
    });

    const mkApproval = (over: Record<string, unknown> = {}) => ({
        id: 'a-1',
        status: 'PENDING',
        message: 'Approve to ship',
        workflowId: 'wf-1',
        executionId: 'exec-1',
        stepId: 'step-approval',
        requestedBy: null,
        approvedBy: null,
        approvedAt: null,
        comment: null,
        createdAt: new Date('2026-04-07T00:00:00Z'),
        workflow: { id: 'wf-1', slug: 'deploy', name: 'Deploy' },
        ...over,
    });

    it('defaults to PENDING and scopes via workflow.tenantId', async () => {
        findManyMock.mockResolvedValue([mkApproval()]);
        const res = await request(buildApp()).get('/api/v1/approvals');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].id).toBe('a-1');
        expect(res.body.data[0].workflow.slug).toBe('deploy');
        expect(res.body.nextCursor).toBeNull();

        const args = findManyMock.mock.calls[0][0];
        expect(args.where.workflow.tenantId).toBe('tenant-1');
        expect(args.where.status).toEqual({ in: ['PENDING'] });
    });

    it('?status=all removes the status filter', async () => {
        findManyMock.mockResolvedValue([]);
        const res = await request(buildApp()).get('/api/v1/approvals?status=all');
        expect(res.status).toBe(200);
        const args = findManyMock.mock.calls[0][0];
        expect(args.where.status).toBeUndefined();
    });

    it('?status=APPROVED filters by APPROVED', async () => {
        findManyMock.mockResolvedValue([]);
        await request(buildApp()).get('/api/v1/approvals?status=APPROVED');
        const args = findManyMock.mock.calls[0][0];
        expect(args.where.status).toEqual({ in: ['APPROVED'] });
    });

    it('rejects an unknown status with 400', async () => {
        const res = await request(buildApp()).get('/api/v1/approvals?status=foo');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('invalid_status');
    });

    it('returns nextCursor when more rows are available', async () => {
        // Request limit=2, fake returns 3 → hasMore=true
        findManyMock.mockResolvedValue([
            mkApproval({ id: 'a-1' }),
            mkApproval({ id: 'a-2' }),
            mkApproval({ id: 'a-3' }),
        ]);
        const res = await request(buildApp()).get('/api/v1/approvals?limit=2');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.nextCursor).toBe('a-2');
        const args = findManyMock.mock.calls[0][0];
        expect(args.take).toBe(3);
    });

    it('caps limit at 200', async () => {
        findManyMock.mockResolvedValue([]);
        await request(buildApp()).get('/api/v1/approvals?limit=999');
        const args = findManyMock.mock.calls[0][0];
        expect(args.take).toBe(201);
    });
});

describe('POST /api/v1/approvals/:id/grant', () => {
    beforeEach(() => {
        resolveMock.mockReset();
    });

    it('returns 200 with the resolved approval on grant', async () => {
        resolveMock.mockResolvedValue({
            id: 'approval-1',
            status: 'APPROVED',
            workflowId: 'wf-1',
            executionId: 'exec-1',
            stepId: 'step-1',
            approvedBy: 'apikey:k-1',
            approvedAt: new Date('2026-04-07T00:00:00Z'),
            comment: 'looks good',
            executionResumed: true,
            executionCancelled: false,
        });

        const res = await request(buildApp())
            .post('/api/v1/approvals/approval-1/grant')
            .send({ comment: 'looks good' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('APPROVED');
        expect(res.body.executionResumed).toBe(true);
        expect(resolveMock).toHaveBeenCalledWith({
            approvalId: 'approval-1',
            tenantId: 'tenant-1',
            action: 'grant',
            actorId: 'apikey:k-1',
            comment: 'looks good',
        });
    });

    it('returns 404 when ApprovalService throws approval_not_found', async () => {
        resolveMock.mockRejectedValue(
            new ApprovalServiceError('approval_not_found', 'Approval ghost not found'),
        );
        const res = await request(buildApp())
            .post('/api/v1/approvals/ghost/grant')
            .send({});
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('approval_not_found');
    });

    it('returns 409 when already resolved', async () => {
        resolveMock.mockRejectedValue(
            new ApprovalServiceError('approval_not_pending', 'Approval is no longer pending'),
        );
        const res = await request(buildApp())
            .post('/api/v1/approvals/a/grant')
            .send({});
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('approval_not_pending');
    });

    it('rejects bad body shapes with 400', async () => {
        const res = await request(buildApp())
            .post('/api/v1/approvals/a/grant')
            .send({ comment: 'x'.repeat(5000) }); // exceeds max(2000)
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('invalid_body');
    });

    it('passes the actor id derived from the API key context', async () => {
        (global as any).__fakeApiContext = {
            keyId: 'k-42',
            tenantId: 'tenant-9',
            scopes: ['approvals:resolve'],
        };
        resolveMock.mockResolvedValue({
            id: 'a',
            status: 'APPROVED',
            workflowId: 'w',
            executionId: 'e',
            stepId: 's',
            approvedBy: 'apikey:k-42',
            approvedAt: new Date(),
            comment: null,
            executionResumed: true,
            executionCancelled: false,
        });
        await request(buildApp()).post('/api/v1/approvals/a/grant').send({});
        expect(resolveMock).toHaveBeenCalledWith(
            expect.objectContaining({ actorId: 'apikey:k-42', tenantId: 'tenant-9' }),
        );
    });
});

describe('POST /api/v1/approvals/:id/reject', () => {
    beforeEach(() => {
        resolveMock.mockReset();
        (global as any).__fakeApiContext = undefined;
    });

    it('returns the cancelled execution on reject', async () => {
        resolveMock.mockResolvedValue({
            id: 'a',
            status: 'REJECTED',
            workflowId: 'w',
            executionId: 'e',
            stepId: 's',
            approvedBy: 'apikey:k-1',
            approvedAt: new Date(),
            comment: 'too risky',
            executionResumed: false,
            executionCancelled: true,
        });

        const res = await request(buildApp())
            .post('/api/v1/approvals/a/reject')
            .send({ comment: 'too risky' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('REJECTED');
        expect(res.body.executionCancelled).toBe(true);
        expect(resolveMock).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'reject', comment: 'too risky' }),
        );
    });
});
