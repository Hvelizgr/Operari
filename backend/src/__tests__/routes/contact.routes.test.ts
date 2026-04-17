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

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/api/contact', contactRouter);
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

    it('rejects a message over 5000 chars (schema cap)', async () => {
        const long = 'a'.repeat(5001);
        const res = await request(app)
            .post('/api/contact')
            .send({ name: 'Jane', email: 'jane@acme.dev', message: long });

        expect(res.status).toBe(400);
        expect(res.body.issues[0].path).toBe('message');
    });
});
