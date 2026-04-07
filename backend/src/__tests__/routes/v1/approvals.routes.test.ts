import express from 'express';
import request from 'supertest';

jest.mock('../../../server', () => ({ prisma: {} }));

jest.mock('../../../middleware/api-key.middleware', () => ({
    requireApiKey: (_scope?: string) => (req: any, _res: any, next: any) => {
        req.apiContext = (global as any).__fakeApiContext ?? {
            keyId: 'k-1',
            tenantId: 'tenant-1',
            scopes: ['approvals:resolve'],
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

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/approvals', approvalsRouter);
    return app;
};

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
