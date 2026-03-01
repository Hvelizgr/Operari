import { Router } from 'express';
import { logger } from '../config/logger.config';
import { n8nService } from '../services/n8n.service';
import { prisma } from '../server';

const router = Router();

/**
 * @swagger
 * /node-types:
 *   get:
 *     summary: List available node types (n8n + Native)
 *     tags: [NodeTypes]
 *     responses:
 *       200:
 *         description: List of node types
 *         content:
 *           application/json:
 *             example:
 *               - type: "WebScraper"
 *                 category: "core"
 *                 label: { "en": "Web Scraper", "es": "Extractor Web" }
 */
router.get('/', async (req, res) => {
  try {
    // Parallel fetch for better performance
    const [n8nNodes, nativeNodes] = await Promise.all([
      n8nService.getRemoteNodeDefinitions(),
      prisma.nodeType.findMany()
    ]);
    
    // Merge them, prioritizing Native nodes if there are type collisions
    const nodeMap = new Map();
    
    n8nNodes.forEach(node => nodeMap.set(node.type, node));
    nativeNodes.forEach(node => nodeMap.set(node.type, node));

    res.json(Array.from(nodeMap.values()));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching node types');
    res.status(500).json({ error: 'Failed to fetch node types' });
  }
});

export default router;
