import express from 'express';
import request from 'supertest';

// Silence pino so the test output stays clean. The route fires
// logger.info on every accepted submission which would otherwise
// emit a JSON line per test case.
jest.mock('../../config/logger.config', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import contactRouter from '../../routes/contact.routes';

describe('Contact routes', () => {
    let app: express.Application;
    const originalResendKey = process.env.RESEND_API_KEY;

    beforeEach(() => {
        jest.clearAllMocks();
        // Default: no provider wired — the route falls back to logging.
        // Individual tests that exercise the provider path set the env
        // var explicitly + stub global.fetch.
        delete process.env.RESEND_API_KEY;
        app = express();
        app.use(express.json());
        app.use('/api/contact', contactRouter);
    });

    afterAll(() => {
        if (originalResendKey !== undefined) {
            process.env.RESEND_API_KEY = originalResendKey;
        } else {
            delete process.env.RESEND_API_KEY;
        }
    });

    it('accepts a valid submission with 202 + ok body', async () => {
        const res = await request(app)
            .post('/api/contact')
            .send({
                name: 'Jane SRE',
                email: 'jane@acme.dev',
                company: 'Acme',
                message: 'Hi, we want NanoRun for incident response.',
            });

        expect(res.status).toBe(202);
        expect(res.body).toEqual({
            ok: true,
            message: expect.stringContaining('48 hours'),
        });
    });

    it('accepts a submission without a company (field is optional)', async () => {
        const res = await request(app)
            .post('/api/contact')
            .send({
                name: 'Jane',
                email: 'jane@acme.dev',
                message: 'Just kicking the tires.',
            });

        expect(res.status).toBe(202);
    });

    it('rejects a missing email with 400 + zod issue', async () => {
        const res = await request(app)
            .post('/api/contact')
            .send({ name: 'Jane', message: 'Hi' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('validation_failed');
        expect(res.body.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: 'email' }),
            ]),
        );
    });

    it('rejects a malformed email with 400', async () => {
        const res = await request(app)
            .post('/api/contact')
            .send({ name: 'Jane', email: 'not-an-email', message: 'Hi' });

        expect(res.status).toBe(400);
        expect(res.body.issues[0].path).toBe('email');
    });

    it('rejects a blank message with 400', async () => {
        const res = await request(app)
            .post('/api/contact')
            .send({ name: 'Jane', email: 'jane@acme.dev', message: '' });

        expect(res.status).toBe(400);
        expect(res.body.issues[0].path).toBe('message');
    });

    it('silently swallows honeypot trips with 204 (bot bait)', async () => {
        const res = await request(app)
            .post('/api/contact')
            .send({
                name: 'Bot',
                email: 'bot@evil.io',
                message: 'spam',
                website: 'https://spam.example',
            });

        expect(res.status).toBe(204);
        // Empty body on 204 — supertest exposes it as '' not {}.
        expect(res.body).toEqual({});
    });

    describe('with RESEND_API_KEY set', () => {
        let fetchSpy: jest.SpyInstance;
        let fetchMock: jest.Mock;

        beforeEach(() => {
            process.env.RESEND_API_KEY = 'test-resend-key';
            fetchMock = jest.fn();
            // Preserve original fetch so other test files using it in
            // this Jest run don't see the stub.
            fetchSpy = jest
                .spyOn(global, 'fetch' as any)
                .mockImplementation((...args: unknown[]) => fetchMock(...args));
        });

        afterEach(() => {
            fetchSpy.mockRestore();
        });

        it('posts to the Resend API when the key is set', async () => {
            fetchMock.mockResolvedValue(
                new Response(JSON.stringify({ id: 'em_abc123' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            const res = await request(app)
                .post('/api/contact')
                .send({
                    name: 'Jane',
                    email: 'jane@acme.dev',
                    company: 'Acme',
                    message: 'Interested in Business tier.',
                });

            expect(res.status).toBe(202);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe('https://api.resend.com/emails');
            expect(init.method).toBe('POST');
            expect(init.headers.Authorization).toBe('Bearer test-resend-key');
            const body = JSON.parse(init.body);
            expect(body.reply_to).toBe('jane@acme.dev');
            expect(body.subject).toContain('Jane');
            expect(body.text).toContain('Acme');
            expect(body.text).toContain('Interested in Business tier.');
            // Company moved from the subject line into the body when
            // contact forwards switched to branded HTML templates;
            // operators read both anyway and the cleaner subject
            // survives Gmail's "View original" preview better.
            expect(body.html).toContain('Acme');
        });

        it('still acks 202 even when Resend returns 5xx (delivery is our problem, not theirs)', async () => {
            fetchMock.mockResolvedValue(
                new Response('upstream overloaded', { status: 503 }),
            );

            const res = await request(app)
                .post('/api/contact')
                .send({ name: 'Jane', email: 'jane@acme.dev', message: 'Hi' });

            expect(res.status).toBe(202);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    it('rejects a message over 5000 chars (schema cap)', async () => {
        const long = 'a'.repeat(5001);
        const res = await request(app)
            .post('/api/contact')
            .send({ name: 'Jane', email: 'jane@acme.dev', message: long });

        expect(res.status).toBe(400);
        expect(res.body.issues[0].path).toBe('message');
    });
});
