import { Request, Response } from 'express';
import axios from 'axios';
import { IntegrationTransformerService } from '../services/integration-transformer.service';
import { logger } from '../config/logger.config';

export class ImportController {
  async importZapier(req: Request, res: Response) {
    try {
      const zapData = req.body;
      if (!zapData || !zapData.steps) {
        return res.status(400).json({ error: 'Invalid Zapier export data' });
      }

      const n8nWorkflow = IntegrationTransformerService.transformZapierToN8n(zapData);
      res.json({ success: true, data: n8nWorkflow });
    } catch (error) {
      logger.error({ error }, 'Zapier import failed');
      res.status(500).json({ error: 'Failed to transform Zapier workflow' });
    }
  }

  async importMake(req: Request, res: Response) {
    try {
      const blueprintData = req.body;
      if (!blueprintData || !blueprintData.flow) {
        return res.status(400).json({ error: 'Invalid Make blueprint data' });
      }

      const n8nWorkflow = IntegrationTransformerService.transformMakeToN8n(blueprintData);
      res.json({ success: true, data: n8nWorkflow });
    } catch (error) {
      logger.error({ error }, 'Make import failed');
      res.status(500).json({ error: 'Failed to transform Make blueprint' });
    }
  }

  async importFromUrl(req: Request, res: Response) {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      let rawUrl = url;
      // Handle Gist
      if (url.includes('gist.github.com') && !url.includes('/raw')) {
        rawUrl = url.endsWith('/') ? `${url}raw` : `${url}/raw`;
      }
      // Handle GitHub blob
      if (url.includes('github.com') && url.includes('/blob/')) {
        rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }

      const response = await axios.get(rawUrl);
      const workflowData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

      // Basic validation
      if (!workflowData || !workflowData.nodes) {
        return res.status(400).json({ error: 'Invalid workflow data at URL' });
      }

      res.json({ success: true, data: workflowData });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, url: req.body.url }, 'URL import failed');
      res.status(500).json({ error: `Failed to import workflow from URL: ${message}` });
    }
  }
}

export const importController = new ImportController();
