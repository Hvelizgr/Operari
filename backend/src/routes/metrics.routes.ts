import { Request, Response, Router } from 'express';

import { getMetrics } from '../observability/metrics';

/**
 * Prometheus scrape endpoint.
 *
 * Mounted in server.ts at /metrics, but only when
 * OPERARI_METRICS_ENABLED=true. The off-by-default posture is
 * deliberate: a stray /metrics endpoint exposes per-tenant series and
 * eventloop telemetry that an operator may not want to publish behind
 * a public ingress without an internal-only network path.
 *
 * The endpoint is unauthenticated by design — Prometheus scrapers do
 * not authenticate and the convention is to gate this with network
 * policy, not bearer tokens. Self-host operators usually expose it
 * only to the cluster's internal network.
 */
const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const { registry } = getMetrics();
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});

export default router;
