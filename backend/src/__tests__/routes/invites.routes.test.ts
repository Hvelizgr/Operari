import request from 'supertest';
import express from 'express';

/**
 * Invite lifecycle tests with a fully mocked prisma + email service.
 * We focus on the state transitions (pending → accepted / revoked /
 * expired) since that's where the subtle bugs live.
 */

jest.mock('../../server', () => {
    const txCallable = async (ops: unknown[]) => Promise.all(ops);
    return {
        prisma: {
            tenantInvite: {
                findUnique: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            tenant: {
                findUnique: jest.fn().mockResolvedValue({ id: 't-1', name: 'Acme' }),
            },
            user: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
            },
            $transaction: jest.fn((ops) => txCallable(ops as unknown[])),
        },
    };
});

jest.mock('../../services/email.service', () => ({
    sendEmail: jest.fn(async () => ({ delivered: true, loggedOnly: true })),
}));

import invitesRoutes from '../../routes/invites.routes';
import { prisma } from '../../server';

const ADMIN_USER = { id: 'u-admin', email: 'admin@acme.io', role: 'ADMIN', tenantId: 't-1' };
const MEMBER_USER = { id: 'u-mem', email: 'mem@acme.io', role: 'USER', tenantId: 't-1' };

function buildApp(user: typeof ADMIN_USER | typeof MEMBER_USER | null) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).log = {
            error: () => { /* noop */ },
            warn: () => { /* noop */ },
            info: () => { /* noop */ },
        };
        if (user) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (req as any).user = user;
        }
        next();
    });
    // Bypass the auth middleware by stamping req.user above — the
    // routes call authenticate() which reads the header, so we need
    // the actual middleware to run. Simpler: mount a shim that
    // accepts when req.user is already set.
    jest.isolateModules(() => {
        // nothing to isolate, just to satisfy the helper for now
    });
    app.use('/api/invites', invitesRoutes);
    return app;
}

// Because the real authenticate middleware reads the Authorization
// header (we'd need to mint a real JWT), we skip it via a module-
// level stub. See the jest.mock block below.
jest.mock('../../middleware/auth.middleware', () => {
    const actual: Record<string, unknown> = jest.requireActual('../../middleware/auth.middleware');
    return {
        ...actual,
        authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
            const user = (req as express.Request & { user?: unknown }).user;
            if (!user) {
                return res.status(401).json({ error: 'No token provided' });
            }
            next();
        },
    };
});

describe('invite routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
        (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 't-1', name: 'Acme' });
        (prisma.tenantInvite.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    });

    describe('POST /api/invites', () => {
        it('401s without session', async () => {
            const app = buildApp(null);
            const res = await request(app).post('/api/invites').send({ email: 'a@b.co' });
            expect(res.status).toBe(401);
        });

        it('403s for non-admin members', async () => {
            const app = buildApp(MEMBER_USER);
            const res = await request(app).post('/api/invites').send({ email: 'a@b.co' });
            expect(res.status).toBe(403);
        });

        it('409s when the email is already on this tenant', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u-existing' });
            const app = buildApp(ADMIN_USER);
            const res = await request(app)
                .post('/api/invites')
                .send({ email: 'dupe@acme.io' });
            expect(res.status).toBe(409);
            expect(prisma.tenantInvite.create).not.toHaveBeenCalled();
        });

        it('creates an invite and revokes prior pending ones for the same email', async () => {
            (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.tenantInvite.create as jest.Mock).mockResolvedValue({
                id: 'inv-1',
                email: 'new@acme.io',
                role: 'USER',
                expiresAt: new Date(Date.now() + 7 * 86400_000),
            });

            const app = buildApp(ADMIN_USER);
            const res = await request(app)
                .post('/api/invites')
                .send({ email: 'new@acme.io', role: 'USER' });
            expect(res.status).toBe(201);
            expect(prisma.tenantInvite.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        tenantId: 't-1',
                        email: 'new@acme.io',
                        acceptedAt: null,
                        revokedAt: null,
                    }),
                    data: expect.objectContaining({ revokedAt: expect.any(Date) }),
                }),
            );
            expect(prisma.tenantInvite.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        email: 'new@acme.io',
                        tenantId: 't-1',
                        role: 'USER',
                        invitedByUserId: 'u-admin',
                    }),
                }),
            );
        });
    });

    describe('GET /api/invites/lookup/:token', () => {
        it('404s for an unknown token', async () => {
            (prisma.tenantInvite.findUnique as jest.Mock).mockResolvedValue(null);
            const app = buildApp(null);
            const res = await request(app).get('/api/invites/lookup/bogus');
            expect(res.status).toBe(404);
        });

        it('410s for a revoked invite', async () => {
            (prisma.tenantInvite.findUnique as jest.Mock).mockResolvedValue({
                email: 'new@acme.io',
                role: 'USER',
                expiresAt: new Date(Date.now() + 60_000),
                acceptedAt: null,
                revokedAt: new Date(),
                invitedByUserId: 'u-admin',
                tenant: { name: 'Acme' },
            });
            const app = buildApp(null);
            const res = await request(app).get('/api/invites/lookup/bogus');
            expect(res.status).toBe(410);
        });

        it('410s for an accepted invite', async () => {
            (prisma.tenantInvite.findUnique as jest.Mock).mockResolvedValue({
                email: 'new@acme.io',
                role: 'USER',
                expiresAt: new Date(Date.now() + 60_000),
                acceptedAt: new Date(Date.now() - 1000),
                revokedAt: null,
                invitedByUserId: 'u-admin',
                tenant: { name: 'Acme' },
            });
            const app = buildApp(null);
            const res = await request(app).get('/api/invites/lookup/bogus');
            expect(res.status).toBe(410);
        });

        it('410s for an expired invite', async () => {
            (prisma.tenantInvite.findUnique as jest.Mock).mockResolvedValue({
                email: 'new@acme.io',
                role: 'USER',
                expiresAt: new Date(Date.now() - 60_000),
                acceptedAt: null,
                revokedAt: null,
                invitedByUserId: 'u-admin',
                tenant: { name: 'Acme' },
            });
            const app = buildApp(null);
            const res = await request(app).get('/api/invites/lookup/bogus');
            expect(res.status).toBe(410);
        });

        it('returns metadata for a pending invite', async () => {
            (prisma.tenantInvite.findUnique as jest.Mock).mockResolvedValue({
                email: 'new@acme.io',
                role: 'USER',
                expiresAt: new Date(Date.now() + 60_000),
                acceptedAt: null,
                revokedAt: null,
                invitedByUserId: 'u-admin',
                tenant: { name: 'Acme' },
            });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                email: 'admin@acme.io',
                name: 'Jane',
            });
            const app = buildApp(null);
            const res = await request(app).get('/api/invites/lookup/bogus');
            expect(res.status).toBe(200);
            expect(res.body.data).toMatchObject({
                email: 'new@acme.io',
                role: 'USER',
                tenantName: 'Acme',
                invitedBy: 'admin@acme.io',
            });
        });
    });

    describe('POST /api/invites/accept', () => {
        it('410s for a revoked invite', async () => {
            (prisma.tenantInvite.findUnique as jest.Mock).mockResolvedValue({
                id: 'i-1',
                email: 'new@acme.io',
                role: 'USER',
                tenantId: 't-1',
                expiresAt: new Date(Date.now() + 60_000),
                acceptedAt: null,
                revokedAt: new Date(),
            });
            const app = buildApp(null);
            const res = await request(app)
                .post('/api/invites/accept')
                .send({ token: 'bogus-token-xxx', password: 'longenough' });
            expect(res.status).toBe(410);
        });

        it('409s when the email already belongs to another user', async () => {
            (prisma.tenantInvite.findUnique as jest.Mock).mockResolvedValue({
                id: 'i-1',
                email: 'new@acme.io',
                role: 'USER',
                tenantId: 't-1',
                expiresAt: new Date(Date.now() + 60_000),
                acceptedAt: null,
                revokedAt: null,
            });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u-existing' });
            const app = buildApp(null);
            const res = await request(app)
                .post('/api/invites/accept')
                .send({ token: 'bogus-token-xxx', password: 'longenough' });
            expect(res.status).toBe(409);
        });

        it('creates the user, marks the invite accepted, sets the session cookie', async () => {
            (prisma.tenantInvite.findUnique as jest.Mock).mockResolvedValue({
                id: 'i-1',
                email: 'new@acme.io',
                role: 'USER',
                tenantId: 't-1',
                expiresAt: new Date(Date.now() + 60_000),
                acceptedAt: null,
                revokedAt: null,
            });
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.user.create as jest.Mock).mockResolvedValue({
                id: 'u-new',
                email: 'new@acme.io',
                name: 'Alice',
                role: 'USER',
                tenantId: 't-1',
            });
            (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 't-1', name: 'Acme' });

            const app = buildApp(null);
            const res = await request(app)
                .post('/api/invites/accept')
                .send({ token: 'bogus-token-xxx', password: 'longenough', name: 'Alice' });

            expect(res.status).toBe(201);
            expect(res.body.user.email).toBe('new@acme.io');
            expect(res.body.tenant.name).toBe('Acme');
            expect(prisma.user.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tenantId: 't-1',
                        role: 'USER',
                        emailVerified: true,
                    }),
                }),
            );
            expect(prisma.tenantInvite.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'i-1' },
                    data: expect.objectContaining({
                        acceptedAt: expect.any(Date),
                        acceptedByUserId: 'u-new',
                    }),
                }),
            );
            const cookies = res.headers['set-cookie'];
            const cookiesArray = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
            expect(cookiesArray.some((c: string) => c.startsWith('nanorun_session='))).toBe(true);
        });
    });
});
