import type { PrismaClient } from '@prisma/client';
import { type Response, Router } from 'express';

import { FileStore, FileStoreError } from '../files/file-store';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/files/:id — download a file a step produced. Tenant-scoped like
 * every file read; served as an attachment with nosniff so a stored HTML
 * or SVG file can never render in the app's origin.
 */
export function createFilesRouter(prisma: PrismaClient, store = new FileStore(prisma)): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
      const { ref, data } = await store.read(req.user!.tenantId, String(req.params.id));
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${ref.name.replace(/["\\\r\n]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(ref.name)}`
      );
      res.setHeader('X-File-Type', ref.mimeType);
      res.send(data);
    } catch (err) {
      const status = err instanceof FileStoreError ? err.status : 500;
      res
        .status(status)
        .json({ error: err instanceof FileStoreError ? err.message : 'Could not read the file' });
    }
  });
  return router;
}
