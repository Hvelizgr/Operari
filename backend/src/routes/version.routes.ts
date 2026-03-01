import { Router, Request, Response, NextFunction } from 'express';
import { versionService } from '../services/version.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/workflow/:workflowId/versions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowId = req.params.workflowId as string;
        const versions = await versionService.getVersions(workflowId);
        res.json(versions);
    } catch (error) {
        next(error);
    }
});

router.get('/workflow/:workflowId/versions/:version', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowId = req.params.workflowId as string;
        const version = req.params.version as string;
        const versionData = await versionService.getVersion(workflowId, parseInt(version));
        if (!versionData) {
            return res.status(404).json({ error: 'Version not found' });
        }
        res.json(versionData);
    } catch (error) {
        next(error);
    }
});

router.post('/workflow/:workflowId/versions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowId = req.params.workflowId as string;
        const { name, description, nodes, connections } = req.body;
        const userId = (req as any).user.userId;

        const version = await versionService.createVersion(workflowId, userId, {
            name,
            description,
            nodes,
            connections,
        });

        res.status(201).json(version);
    } catch (error) {
        next(error);
    }
});

router.post('/workflow/:workflowId/versions/:version/restore', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowId = req.params.workflowId as string;
        const version = req.params.version as string;
        const restored = await versionService.restoreVersion(workflowId, parseInt(version));
        res.json(restored);
    } catch (error) {
        next(error);
    }
});

router.get('/workflow/:workflowId/versions/compare', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowId = req.params.workflowId as string;
        const versionA = req.query.versionA as string;
        const versionB = req.query.versionB as string;
        
        if (!versionA || !versionB) {
            return res.status(400).json({ error: 'versionA and versionB are required' });
        }

        const comparison = await versionService.compareVersions(
            workflowId,
            parseInt(versionA),
            parseInt(versionB)
        );
        res.json(comparison);
    } catch (error) {
        next(error);
    }
});

router.get('/github/integration', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = (req as any).user.tenantId as string;
        const integration = await versionService.getGitHubIntegration(tenantId);
        
        if (!integration) {
            return res.json({ configured: false });
        }

        res.json({
            configured: true,
            owner: integration.owner,
            repo: integration.repo,
            branch: integration.branch,
            path: integration.path,
        });
    } catch (error) {
        next(error);
    }
});

router.post('/github/integration', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = (req as any).user.tenantId as string;
        const { accessToken, owner, repo, branch, path } = req.body;

        if (!accessToken || !owner || !repo) {
            return res.status(400).json({ error: 'accessToken, owner, and repo are required' });
        }

        const integration = await versionService.setupGitHubIntegration(
            tenantId,
            accessToken,
            owner,
            repo,
            branch,
            path
        );

        res.json({
            configured: true,
            owner: integration.owner,
            repo: integration.repo,
            branch: integration.branch,
            path: integration.path,
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/github/integration', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = (req as any).user.tenantId as string;
        await versionService.removeGitHubIntegration(tenantId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

router.post('/github/push/:workflowId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowId = req.params.workflowId as string;
        const { message } = req.body;
        const tenantId = (req as any).user.tenantId as string;
        const userId = (req as any).user.userId as string;

        const result = await versionService.pushToGitHub(
            tenantId,
            workflowId,
            userId,
            message || 'Update workflow'
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/github/workflows', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = (req as any).user.tenantId as string;
        const workflows = await versionService.listGitHubWorkflows(tenantId);
        res.json(workflows);
    } catch (error) {
        next(error);
    }
});

router.get('/github/history/:workflowName', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowName = req.params.workflowName as string;
        const tenantId = (req as any).user.tenantId as string;
        const history = await versionService.getCommitHistory(tenantId, workflowName);
        res.json(history);
    } catch (error) {
        next(error);
    }
});

router.post('/github/pull/:workflowName', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowName = req.params.workflowName as string;
        const tenantId = (req as any).user.tenantId as string;
        const workflowData = await versionService.pullFromGitHub(tenantId, workflowName);
        res.json(workflowData);
    } catch (error) {
        next(error);
    }
});

export default router;
