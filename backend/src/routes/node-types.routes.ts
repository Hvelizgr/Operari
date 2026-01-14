
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/node-types
router.get('/', async (req, res) => {
    try {
        const nodeTypes = await prisma.nodeType.findMany({
            orderBy: { type: 'asc' }
        });
        res.json(nodeTypes);
    } catch (error) {
        console.error('Error fetching node types:', error);
        res.status(500).json({ error: 'Failed to fetch node types' });
    }
});

export default router;
