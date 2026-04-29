import express from 'express';
import { Registry as PromRegistry } from 'prom-client';
import request from 'supertest';

import metricsRoutes from '../../routes/metrics.routes';

/**
 * The /metrics route is intentionally tiny: it asks the metrics
 * registry for a Prometheus-formatted dump and copies the registry's
 * contentType into the response. The interesting part to pin is the
 * content type and the fact that the response actually contains the
 * counters we registered.
 */

const buildMetricsMock = jest.fn();

jest.mock('../../observability/metrics', () => ({
  getMetrics: () => buildMetricsMock(),
}));

function makeApp() {
  const app = express();
  app.use('/metrics', metricsRoutes);
  return app;
}

beforeEach(() => {
  buildMetricsMock.mockReset();
});

describe('GET /metrics', () => {
  it('returns the Prometheus text body with the registry contentType', async () => {
    const registry = new PromRegistry();
    // Drop a single counter onto the registry so the body is non-empty
    // and we can assert on its presence.
    const { Counter } = await import('prom-client');
    new Counter({ name: 'operari_test_counter', help: 'test', registers: [registry] })
      .labels({})
      .inc(3);

    buildMetricsMock.mockReturnValue({ registry });

    const res = await request(makeApp()).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['content-type']).toMatch(/version=/);
    expect(res.text).toContain('operari_test_counter 3');
  });

  it('serves cleanly when the registry has no metrics', async () => {
    const registry = new PromRegistry();
    buildMetricsMock.mockReturnValue({ registry });

    const res = await request(makeApp()).get('/metrics');

    expect(res.status).toBe(200);
    // prom-client returns either '' or '\n' for an empty registry
    // depending on version. Both are valid; the contract is "200 OK
    // with no metric lines", not a specific byte.
    expect(res.text.trim()).toBe('');
  });
});
