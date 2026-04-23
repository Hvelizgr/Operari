import { PrismaClient } from '@prisma/client';
import { Router } from 'express';

import { logger } from '../config/logger.config';
import { attachUserIfPresent, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/node-types
 *
 * Returns the node types the editor palette should render. Two scopes:
 *   - Global core types (NodeType.tenantId IS NULL). Seeded once at
 *     deploy time and available to every tenant.
 *   - Tenant-owned custom types (NodeType.tenantId = caller's tenant).
 *     Installed via the SDK plugin path; invisible to other tenants.
 *
 * Authentication is soft: an unauthenticated request (public landing
 * editor, logged-out preview) gets globals only. An authenticated
 * request gets globals UNION their tenant's custom rows. This matches
 * the existing soft-auth contract on the rest of the editor API.
 *
 * @swagger
 * /node-types:
 *   get:
 *     summary: List node types available to the caller
 *     tags: [NodeTypes]
 *     responses:
 *       200:
 *         description: Node types (globals + caller's tenant-owned rows)
 */
router.get('/', attachUserIfPresent, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const nodeTypes = await prisma.nodeType.findMany({
      where: tenantId
        ? // Globals (tenantId IS NULL) UNION the caller's tenant rows.
          // Prisma's OR with two scoped branches is the clearest way
          // to express this; Postgres produces an index-union plan.
          { OR: [{ tenantId: null }, { tenantId }] }
        : { tenantId: null },
      orderBy: { type: 'asc' },
    });
    res.json(nodeTypes);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching node types');
    res.status(500).json({ error: 'Failed to fetch node types' });
  }
});

export default router;
