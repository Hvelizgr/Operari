import express, { type Request, type Response, Router } from 'express';

import { type LogCallbackRegistry, runnerLogCallbacks } from '../runbook/runners/log-callbacks';

/**
 * POST /webhook/runner-logs/:token?stream=stdout|stderr&seq=N
 *
 * One line of output from a remote runner (Fly Machine). The token in the
 * path, minted per machine, is the only credential; an unknown or expired
 * token gets 404 so it cannot be told apart from a wrong URL. Mounted under
 * /webhook so CSRF and the session layer stay out of the way.
 */
export function createRunnerLogsRouter(registry: LogCallbackRegistry = runnerLogCallbacks): Router {
  const router = Router();
  router.post(
    '/:token',
    express.text({ type: () => true, limit: '64kb' }),
    (req: Request, res: Response) => {
      const stream = req.query.stream;
      const seq = Number(req.query.seq);
      if ((stream !== 'stdout' && stream !== 'stderr') || !Number.isInteger(seq) || seq < 1) {
        return res.status(400).end();
      }
      const text = typeof req.body === 'string' ? req.body : '';
      const ok = registry.deliver(String(req.params.token), { stream, seq, text });
      return res.status(ok ? 204 : 404).end();
    }
  );
  return router;
}
