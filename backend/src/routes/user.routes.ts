import { Router } from 'express';
import { prisma } from '../server';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users in the current tenant
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', requireRole(Role.ADMIN), async (req: AuthRequest, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { tenantId: req.user!.tenantId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
        });
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Failed to find users' });
    }
});

/**
 * @swagger
 * /users/{id}/role:
 *   put:
 *     summary: Update user role
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [ADMIN, USER, VIEWER]
 *     responses:
 *       200:
 *         description: Role updated
 */
router.put('/:id/role', requireRole(Role.ADMIN), async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { role } = req.body;

        if (!Object.values(Role).includes(role as Role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Prevent admin from downgrading themselves if they are the last admin?
        // Basic implementation for now.
        
        const updatedUser = await prisma.user.update({
            where: { id, tenantId: req.user!.tenantId },
            data: { role: role as Role },
        });

        res.json({ success: true, user: { id: updatedUser.id, role: updatedUser.role } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

export default router;
