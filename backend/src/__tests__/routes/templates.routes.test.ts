import request from 'supertest';
import express from 'express';
import templatesRoutes from '../../routes/templates.routes';

/**
 * Tests hit the real templates/ directory in the repo — the routes
 * already scan multiple candidate paths, and from the backend source
 * root `../../../templates` resolves to the committed curated set.
 * We pin two behaviours that matter for the public gallery page:
 *
 *   1. The list endpoint returns at least the k8s-rolling-deploy
 *      template with the expected fields (slug + yaml body).
 *   2. The single-template endpoint returns 404 for unknown slugs
 *      and the full payload for a known one.
 *
 * If the curated set changes (a template gets renamed), update the
 * expectations here — the test doubles as documentation of the
 * shipping library.
 */

const app = express();
app.use(express.json());
app.use('/api/templates', templatesRoutes);

describe('GET /api/templates', () => {
    it('returns the curated list with slug + yaml + stepCount', async () => {
        const response = await request(app).get('/api/templates');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);

        const k8s = response.body.data.find(
            (t: { slug: string }) => t.slug === 'k8s-rolling-deploy',
        );
        expect(k8s).toBeDefined();
        expect(k8s.name).toBeTruthy();
        expect(typeof k8s.yaml).toBe('string');
        expect(k8s.yaml.length).toBeGreaterThan(0);
        expect(typeof k8s.stepCount).toBe('number');
        expect(k8s.stepCount).toBeGreaterThan(0);
    });
});

describe('GET /api/templates/:slug', () => {
    it('returns 200 + payload for a known slug', async () => {
        const response = await request(app).get('/api/templates/k8s-rolling-deploy');
        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.slug).toBe('k8s-rolling-deploy');
        expect(response.body.data.yaml).toMatch(/K8s Rolling Deploy/);
    });

    it('returns 404 for an unknown slug without leaking filesystem paths', async () => {
        const response = await request(app).get('/api/templates/does-not-exist-anywhere');
        expect(response.status).toBe(404);
        expect(response.body.error).toMatch(/not found/i);
        // Defensive: make sure we never echo a path back
        expect(JSON.stringify(response.body)).not.toMatch(/\/app\/|\/home\//);
    });

    it('rejects an empty-ish slug', async () => {
        // With `/:slug` Express will not match an empty segment, so
        // this actually hits the list route (200). Documenting the
        // behaviour to pin it.
        const response = await request(app).get('/api/templates/');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
    });
});
