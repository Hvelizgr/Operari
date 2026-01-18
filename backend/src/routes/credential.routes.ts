import { Router } from 'express';
import { credentialController } from '../controllers/credential.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/credentials:
 *   post:
 *     summary: Create a new credential
 *     tags: [Credentials]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, data]
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               data:
 *                 type: object
 *               description:
 *                 type: string
 *               scope:
 *                 type: object
 *     responses:
 *       201:
 *         description: Credential created
 */
router.post('/', requireRole(Role.ADMIN, Role.USER), credentialController.create.bind(credentialController));

/**
 * @swagger
 * /api/credentials:
 *   get:
 *     summary: List credentials
 *     tags: [Credentials]
 *     parameters:
 *       - in: query
 *         name: environment
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of credentials
 */
router.get('/', credentialController.list.bind(credentialController));

/**
 * @swagger
 * /api/credentials/{id}:
 *   put:
 *     summary: Update a credential
 *     tags: [Credentials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Credential updated
 */
router.put('/:id', requireRole(Role.ADMIN, Role.USER), credentialController.update.bind(credentialController));

/**
 * @swagger
 * /api/credentials/{id}:
 *   delete:
 *     summary: Delete a credential
 *     tags: [Credentials]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Credential deleted
 */
router.delete('/:id', requireRole(Role.ADMIN), credentialController.delete.bind(credentialController));

export default router;
