import { Router } from 'express';
import { gitController } from '../controllers/git.controller';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.use((req: AuthRequest, _res, next) => {
    if (!req.user) {
        req.user = {
            id: 'anonymous',
            email: 'anonymous@nanoflow.local',
            role: 'USER',
            tenantId: 'default-tenant',
        };
    }
    next();
});

/**
 * @swagger
 * /api/git/init:
 *   post:
 *     summary: Initialize a git repository for workflow exports
 *     tags: [Git]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repoPath:
 *                 type: string
 *                 description: Custom path for the repository (optional)
 *     responses:
 *       200:
 *         description: Repository initialized successfully
 */
router.post('/init', gitController.initRepo.bind(gitController));

/**
 * @swagger
 * /api/git/remote:
 *   post:
 *     summary: Configure a remote for the git repository
 *     tags: [Git]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - remoteUrl
 *             properties:
 *               remoteUrl:
 *                 type: string
 *               remoteName:
 *                 type: string
 *                 default: origin
 *               repoPath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Remote configured successfully
 */
router.post('/remote', gitController.configureRemote.bind(gitController));

/**
 * @swagger
 * /api/git/export:
 *   post:
 *     summary: Export workflows to git repository
 *     tags: [Git]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commitMessage:
 *                 type: string
 *               workflowIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               repoPath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Workflows exported successfully
 */
router.post('/export', gitController.exportWorkflows.bind(gitController));

/**
 * @swagger
 * /api/git/import:
 *   post:
 *     summary: Import workflows from git repository
 *     tags: [Git]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repoPath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Workflows imported successfully
 */
router.post('/import', gitController.importWorkflows.bind(gitController));

/**
 * @swagger
 * /api/git/push:
 *   post:
 *     summary: Push commits to remote repository
 *     tags: [Git]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remoteName:
 *                 type: string
 *                 default: origin
 *               branch:
 *                 type: string
 *                 default: main
 *               repoPath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pushed successfully
 */
router.post('/push', gitController.push.bind(gitController));

/**
 * @swagger
 * /api/git/pull:
 *   post:
 *     summary: Pull changes from remote repository
 *     tags: [Git]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remoteName:
 *                 type: string
 *                 default: origin
 *               branch:
 *                 type: string
 *                 default: main
 *               repoPath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pulled successfully
 */
router.post('/pull', gitController.pull.bind(gitController));

/**
 * @swagger
 * /api/git/status:
 *   get:
 *     summary: Get git repository status
 *     tags: [Git]
 *     parameters:
 *       - in: query
 *         name: repoPath
 *         schema:
 *           type: string
 *         description: Custom repository path
 *     responses:
 *       200:
 *         description: Repository status
 */
router.get('/status', gitController.getStatus.bind(gitController));

/**
 * @swagger
 * /api/git/log:
 *   get:
 *     summary: Get git commit history
 *     tags: [Git]
 *     parameters:
 *       - in: query
 *         name: repoPath
 *         schema:
 *           type: string
 *       - in: query
 *         name: maxCount
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Commit history
 */
router.get('/log', gitController.getLog.bind(gitController));

/**
 * @swagger
 * /api/git/branches:
 *   get:
 *     summary: Get git branches
 *     tags: [Git]
 *     responses:
 *       200:
 *         description: List of branches
 */
router.get('/branches', gitController.getBranches.bind(gitController));

/**
 * @swagger
 * /api/git/checkout:
 *   post:
 *     summary: Checkout a branch
 *     tags: [Git]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [branch]
 *             properties:
 *               branch: { type: string }
 *               create: { type: boolean }
 *     responses:
 *       200:
 *         description: Branch changed
 */
router.post('/checkout', gitController.checkout.bind(gitController));

/**
 * @swagger
 * /api/git/diff/{workflowId}:
 *   get:
 *     summary: Get diff for a workflow
 *     tags: [Git]
 */
router.get('/diff/:workflowId', gitController.getDiff.bind(gitController));

/**
 * @swagger
 * /api/git/config:
 *   get:
 *     summary: Get GitHub integration config
 *     tags: [Git]
 */
router.get('/config', gitController.getConfig.bind(gitController));

/**
 * @swagger
 * /api/git/config:
 *   post:
 *     summary: Save GitHub integration config
 *     tags: [Git]
 */
router.post('/config', gitController.saveConfig.bind(gitController));

export default router;
