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
import { NodeLoaderService } from '../services/node-loader.service';
import { PluginManager } from '../plugins/PluginManager';

router.get('/', async (req, res) => {
    try {
        const dbNodes = await prisma.nodeType.findMany({
            orderBy: { type: 'asc' }
        });

        const dynamicNodes = NodeLoaderService.getInstance().getLoadedNodes().map(node => ({
            id: node.id,
            type: node.id,
            category: node.executor?.meta?.category || 'Custom',
            description: node.description,
            name: node.name,
            icon: node.executor?.meta?.icon
        }));

        const pluginNodes = PluginManager.getInstance().getAllPlugins().map((plugin: any) => ({
            id: `plugin-${plugin.meta.name.toLowerCase().replace(/\s+/g, '-')}`,
            type: `plugin-${plugin.meta.name.toLowerCase().replace(/\s+/g, '-')}`,
            category: plugin.meta.category || 'Plugins',
            description: plugin.meta.description,
            name: plugin.meta.name,
            icon: plugin.meta.icon,
            isPlugin: true
        }));

        res.json([...dbNodes, ...dynamicNodes, ...pluginNodes]);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching node types');
        res.status(500).json({ error: 'Failed to fetch node types' });
    }
});

export default router;
