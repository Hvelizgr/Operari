import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.config';

const router = Router();
const prisma = new PrismaClient();

// GET /api/node-types
/**
 * @swagger
 * /node-types:
 *   get:
 *     summary: List available node types
 *     tags: [NodeTypes]
 *     responses:
 *       200:
 *         description: List of node types
 *         content:
 *           application/json:
 *             example:
 *               - type: "HTTP"
 *                 category: "Core"
 *                 description: "Make HTTP requests"
 *               - type: "Condition"
 *                 category: "Logic"
 *                 description: "Conditional logic"
 */
router.get('/', async (req, res) => {
  try {
    const nodeTypes = await prisma.nodeType.findMany({
      orderBy: { type: 'asc' },
    });
    res.json(nodeTypes);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching node types');
    res.status(500).json({ error: 'Failed to fetch node types' });
  }
});

export default router;
