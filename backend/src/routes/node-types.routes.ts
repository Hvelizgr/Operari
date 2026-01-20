import { Router } from 'express';
import { logger } from '../config/logger.config';
import { n8nService } from '../services/n8n.service';

const router = Router();

/**
 * @swagger
 * /node-types:
 *   get:
 *     summary: List available node types (from n8n API)
 *     tags: [NodeTypes]
 *     responses:
 *       200:
 *         description: List of node types from n8n
 *         content:
 *           application/json:
 *             example:
 *               - type: "n8n-nodes-base.httpRequest"
 *                 category: "core"
 *                 icon: "/api/n8n/node-icons/httpRequest"
 *                 label: { "en": "HTTP Request", "es": "Petición HTTP" }
 */
import { NodeLoaderService } from '../services/node-loader.service';
import { PluginManager } from '../plugins/PluginManager';

router.get('/', async (req, res) => {
  try {
    // Get nodes from n8n API (includes all n8n node types)
    const n8nNodes = await n8nService.getRemoteNodeDefinitions();

    const dynamicNodes = NodeLoaderService.getInstance()
      .getLoadedNodes()
      .map(node => ({
        id: node.id,
        type: node.id,
        category: node.executor?.meta?.category || 'Custom',
        description: node.description,
        name: node.name,
        icon: node.executor?.meta?.icon,
      }));

    const pluginNodes = PluginManager.getInstance()
      .getAllPlugins()
      .map((plugin: any) => ({
        id: `plugin-${plugin.meta.name.toLowerCase().replace(/\s+/g, '-')}`,
        type: `plugin-${plugin.meta.name.toLowerCase().replace(/\s+/g, '-')}`,
        category: plugin.meta.category || 'Plugins',
        description: plugin.meta.description,
        name: plugin.meta.name,
        icon: plugin.meta.icon,
        isPlugin: true,
      }));

    res.json([...n8nNodes, ...dynamicNodes, ...pluginNodes]);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching node types from n8n');
    res.status(500).json({ error: 'Failed to fetch node types from n8n' });
  }
});

export default router;
