import express from 'express';
import request from 'supertest';

// Mock the prisma re-export from server before importing the router
jest.mock('../../../server', () => ({
    prisma: {
        auditEvent: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));

// Mock the API key middleware so we can inject a fake apiContext
jest.mock('../../../middleware/api-key.middleware', () => ({
    requireApiKey: (_scope?: string) => (req: any, _res: any, next: any) => {
        req.apiContext = (global as any).__fakeApiContext ?? {
            keyId: 'key-1',
            tenantId: 'tenant-test',
            scopes: ['audit:read'],
        };
        next();
    },
}));

// Mock AuditService.verifyChain so the route doesn't touch the (mocked) DB
const verifyChainMock = jest.fn();
jest.mock('../../../audit/audit.service', () => ({
    AuditService: jest.fn().mockImplementation(() => ({
        verifyChain: verifyChainMock,
    })),
}));

import auditRouter from '../../../routes/v1/audit.routes';

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/audit', auditRouter);
    return app;
};

describe('GET /api/v1/audit/verify', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (global as any).__fakeApiContext = {
            keyId: 'key-1',
            tenantId: 'tenant-test',
            scopes: ['audit:read'],
        };
    });

    it('returns intact=true when chain is clean', async () => {
        verifyChainMock.mockResolvedValue({
            tenantId: 'tenant-test',
            eventCount: 42,
            firstBrokenSeq: null,
            firstGapAfterSeq: null,
        });

        const res = await request(buildApp()).get('/api/v1/audit/verify');

        expect(res.status).toBe(200);
        expect(res.body.tenantId).toBe('tenant-test');
        expect(res.body.eventCount).toBe(42);
        expect(res.body.intact).toBe(true);
        expect(res.body.firstBrokenSeq).toBeNull();
        expect(res.body.firstGapAfterSeq).toBeNull();
        expect(typeof res.body.verifiedAt).toBe('string');
        expect(verifyChainMock).toHaveBeenCalledWith('tenant-test', {
            fromSeq: undefined,
            pageSize: undefined,
        });
    });

    it('returns intact=false and serializes BigInt seq fields as strings', async () => {
        verifyChainMock.mockResolvedValue({
            tenantId: 'tenant-test',
            eventCount: 100,
            firstBrokenSeq: 17n,
            firstGapAfterSeq: null,
        });

        const res = await request(buildApp()).get('/api/v1/audit/verify');

        expect(res.status).toBe(200);
        expect(res.body.intact).toBe(false);
        expect(res.body.firstBrokenSeq).toBe('17');
        expect(res.body.firstGapAfterSeq).toBeNull();
    });

    it('also detects gaps as not-intact', async () => {
        verifyChainMock.mockResolvedValue({
            tenantId: 'tenant-test',
            eventCount: 50,
            firstBrokenSeq: null,
            firstGapAfterSeq: 25n,
        });

        const res = await request(buildApp()).get('/api/v1/audit/verify');
        expect(res.body.intact).toBe(false);
        expect(res.body.firstGapAfterSeq).toBe('25');
    });

    it('parses fromSeq query param', async () => {
        verifyChainMock.mockResolvedValue({
            tenantId: 'tenant-test',
            eventCount: 5,
            firstBrokenSeq: null,
            firstGapAfterSeq: null,
        });

        await request(buildApp()).get('/api/v1/audit/verify?fromSeq=100');
        expect(verifyChainMock).toHaveBeenCalledWith('tenant-test', {
            fromSeq: 100n,
            pageSize: undefined,
        });
    });

    it('rejects negative fromSeq', async () => {
        const res = await request(buildApp()).get('/api/v1/audit/verify?fromSeq=-1');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('invalid_fromSeq');
        expect(verifyChainMock).not.toHaveBeenCalled();
    });

    it('rejects non-integer fromSeq', async () => {
        const res = await request(buildApp()).get('/api/v1/audit/verify?fromSeq=abc');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('invalid_fromSeq');
    });

    it('parses pageSize query param', async () => {
        verifyChainMock.mockResolvedValue({
            tenantId: 'tenant-test',
            eventCount: 0,
            firstBrokenSeq: null,
            firstGapAfterSeq: null,
        });

        await request(buildApp()).get('/api/v1/audit/verify?pageSize=500');
        expect(verifyChainMock).toHaveBeenCalledWith('tenant-test', {
            fromSeq: undefined,
            pageSize: 500,
        });
    });

    it('rejects pageSize out of range', async () => {
        const tooBig = await request(buildApp()).get('/api/v1/audit/verify?pageSize=999999');
        expect(tooBig.status).toBe(400);
        expect(tooBig.body.code).toBe('invalid_pageSize');

        const zero = await request(buildApp()).get('/api/v1/audit/verify?pageSize=0');
        expect(zero.status).toBe(400);
    });

    it('uses tenantId from API key context, not from query', async () => {
        verifyChainMock.mockResolvedValue({
            tenantId: 'tenant-test',
            eventCount: 1,
            firstBrokenSeq: null,
            firstGapAfterSeq: null,
        });

        // Even if a malicious caller passes ?tenantId=other, the route ignores it.
        await request(buildApp()).get('/api/v1/audit/verify?tenantId=other-tenant');
        expect(verifyChainMock).toHaveBeenCalledWith('tenant-test', expect.any(Object));
    });
});
