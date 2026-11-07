import { type Request, type Response, Router } from 'express';

import type { WorkflowCallbackService } from '../runbook/services/workflow-callback.service';

const MAX_BYTES = 1024 * 1024;

/**
 * POST /webhook/workflow-callback/:token
 *
 * The path token is the only credential. Unknown, used and expired tokens all
 * get 404 so they cannot be told apart.
 */
export function createWorkflowCallbackRouter(getService: () => WorkflowCallbackService): Router {
  const router = Router();
  router.post('/:token', async (req: Request, res: Response) => {
    const size = (req as unknown as { rawBody?: Buffer }).rawBody?.length ?? 0;
    if (size > MAX_BYTES) return res.status(413).json({ error: 'Payload too large' });
    try {
      const accepted = await getService().receive(String(req.params.token), req.body);
      return res.status(accepted ? 202 : 404).end();
    } catch {
      return res.status(500).end();
    }
  });
  return router;
}
