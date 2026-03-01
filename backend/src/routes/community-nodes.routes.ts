import { Router, Request, Response } from 'express';
import { N8nCommunityNodesService } from '../services/n8n-community-nodes.service';

const router = Router();
const service = N8nCommunityNodesService.getInstance();

router.get('/', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        const result = await service.searchAll(query, limit);
        res.json(result);
    } catch (error) {
        console.error('Error fetching community nodes:', error);
        res.status(500).json({ error: 'Failed to fetch community nodes' });
    }
});

router.get('/github', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        const nodes = await service.searchGitHub(query, limit);
        res.json({ nodes, source: 'github', total: nodes.length });
    } catch (error) {
        console.error('Error fetching GitHub nodes:', error);
        res.status(500).json({ error: 'Failed to fetch GitHub nodes' });
    }
});

router.get('/ncnodes', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        const nodes = await service.searchNCNodes(query, limit);
        res.json({ nodes, source: 'ncnodes', total: nodes.length });
    } catch (error) {
        console.error('Error fetching NCNodes:', error);
        res.status(500).json({ error: 'Failed to fetch NCNodes' });
    }
});

router.get('/npm', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        const nodes = await service.searchNpm(query, limit);
        res.json({ nodes, source: 'npm', total: nodes.length });
    } catch (error) {
        console.error('Error fetching npm nodes:', error);
        res.status(500).json({ error: 'Failed to fetch npm nodes' });
    }
});

router.get('/popular', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await service.getPopularNodes(limit);
        res.json(result);
    } catch (error) {
        console.error('Error fetching popular nodes:', error);
        res.status(500).json({ error: 'Failed to fetch popular nodes' });
    }
});

router.get('/details/:packageName', async (req: Request, res: Response) => {
    try {
        const packageName = req.params.packageName as string;
        const details = await service.getNodeDetails(packageName);
        res.json(details);
    } catch (error) {
        console.error('Error fetching node details:', error);
        res.status(500).json({ error: 'Failed to fetch node details' });
    }
});

router.get('/compatibility/:packageName', async (req: Request, res: Response) => {
    try {
        const packageName = req.params.packageName as string;
        const result = await service.checkCompatibility(packageName);
        res.json(result);
    } catch (error) {
        console.error('Error checking compatibility:', error);
        res.status(500).json({ error: 'Failed to check compatibility' });
    }
});

export default router;
