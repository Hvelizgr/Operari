import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().optional(),
    tenantName: z.string().min(2),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user and tenant
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, tenantName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               tenantName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string }
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                 token: { type: string }
 *             example:
 *               user:
 *                 id: "cm5..."
 *                 email: "admin@company.com"
 *                 name: "Admin User"
 *                 role: "ADMIN"
 *               tenant:
 *                 id: "tenant-123"
 *                 name: "My Company"
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Validation error or email already exists
 *         content:
 *           application/json:
 *             example:
 *               error: "Email already registered"
 */
router.post('/register', async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(data.password, 12);
        const slug = data.tenantName.toLowerCase().replace(/\s+/g, '-');

        const tenant = await prisma.tenant.create({
            data: {
                name: data.tenantName,
                slug: `${slug}-${Date.now()}`,
            },
        });

        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                name: data.name,
                tenantId: tenant.id,
                role: 'ADMIN',
            },
        });

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
            },
            process.env.JWT_SECRET!,
            { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
        );

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
            },
            token,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Register error');
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string }
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                 token: { type: string }
 *             example:
 *               user:
 *                 id: "cm5..."
 *                 email: "user@example.com"
 *                 name: "John Doe"
 *                 role: "USER"
 *               tenant:
 *                 id: "tenant-123"
 *                 name: "Acme Corp"
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid credentials"
 */
router.post('/login', async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email: data.email },
            include: { tenant: true },
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(data.password, user.passwordHash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
            },
            process.env.JWT_SECRET!,
            { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            tenant: {
                id: user.tenant.id,
                name: user.tenant.name,
            },
            token,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Login error');
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             example:
 *               user:
 *                 id: "u-123"
 *                 email: "me@example.com"
 *                 name: "Me"
 *                 role: "ADMIN"
 *               tenant:
 *                 id: "t-456"
 *                 name: "My Tenant"
 *                 plan: "FREE"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             example:
 *               error: "Unauthorized"
 */
router.get('/me', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { tenant: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            tenant: {
                id: user.tenant.id,
                name: user.tenant.name,
                plan: user.tenant.plan,
            },
        });
    } catch (error) {
        req.log.error({ error }, 'Get user error');
        res.status(500).json({ error: 'Failed to get user' });
    }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh authentication token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Invalid or expired token"
 */
router.post('/refresh', authenticate, async (req: AuthRequest, res) => {
    try {
        const token = jwt.sign(
            {
                userId: req.user!.id,
                email: req.user!.email,
                role: req.user!.role,
                tenantId: req.user!.tenantId,
            },
            process.env.JWT_SECRET!,
            { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
        );

        res.json({ token });
    } catch (error) {
        req.log.error({ error }, 'Refresh error');
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

export default router;
