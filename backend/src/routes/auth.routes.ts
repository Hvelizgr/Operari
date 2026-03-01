import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../server';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { emailService } from '../services/email.service';

const router = Router();

const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is not configured');
    }
    return secret;
};

const getOAuthConfig = (provider: 'google' | 'github') => {
    if (provider === 'google') {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            return null;
        }
        return { clientId, clientSecret };
    }
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return null;
    }
    return { clientId, clientSecret };
};

const passwordResetTokens = new Map<string, { email: string; expiresAt: number }>();
const emailVerificationTokens = new Map<string, { userId: string; expiresAt: number }>();

const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

const resetPasswordSchema = z.object({
    token: z.string(),
    newPassword: z.string().min(8),
});

const verifyEmailSchema = z.object({
    token: z.string(),
});

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
                emailVerified: false,
            },
        });

        const verificationToken = crypto.randomBytes(32).toString('hex');
        emailVerificationTokens.set(verificationToken, {
            userId: user.id,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });

        await emailService.sendVerificationEmail(user.email, verificationToken, user.name || undefined);

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
            },
            getJwtSecret(),
            { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
        );

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified,
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
            },
            token,
            message: 'Please check your email to verify your account',
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

        const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';
        if (requireEmailVerification && !user.emailVerified) {
            return res.status(403).json({ 
                error: 'Email not verified',
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your email before logging in. Check your inbox for the verification link.',
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
            },
            getJwtSecret(),
            { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified,
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
            getJwtSecret(),
            { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
        );

        res.json({ token });
    } catch (error) {
        req.log.error({ error }, 'Refresh error');
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const data = forgotPasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (!user) {
            return res.json({ message: 'If email exists, reset link sent' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        passwordResetTokens.set(token, {
            email: data.email,
            expiresAt: Date.now() + 60 * 60 * 1000,
        });

        await emailService.sendPasswordResetEmail(user.email, token, user.name || undefined);

        req.log.info({ email: data.email }, 'Password reset requested');
        res.json({ message: 'If email exists, reset link sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Forgot password error');
        res.status(500).json({ error: 'Failed to process request' });
    }
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 */
router.post('/reset-password', async (req, res) => {
    try {
        const data = resetPasswordSchema.parse(req.body);

        const tokenData = passwordResetTokens.get(data.token);
        if (!tokenData || tokenData.expiresAt < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const passwordHash = await bcrypt.hash(data.newPassword, 12);

        await prisma.user.update({
            where: { email: tokenData.email },
            data: { passwordHash },
        });

        passwordResetTokens.delete(data.token);

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        req.log.error({ error }, 'Reset password error');
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

/**
 * @swagger
 * /auth/send-verification:
 *   post:
 *     summary: Send email verification
 *     tags: [Auth]
 */
router.post('/send-verification', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ error: 'Email already verified' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        emailVerificationTokens.set(token, {
            userId: req.user!.id,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });

        await emailService.sendVerificationEmail(user.email, token, user.name || undefined);

        res.json({ message: 'Verification email sent' });
    } catch (error) {
        req.log.error({ error }, 'Send verification error');
        res.status(500).json({ error: 'Failed to send verification' });
    }
});

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend verification email (no auth required)
 *     tags: [Auth]
 */
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.json({ message: 'If the email exists, a verification link has been sent' });
        }

        if (user.emailVerified) {
            return res.json({ message: 'If the email exists, a verification link has been sent' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        emailVerificationTokens.set(token, {
            userId: user.id,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });

        await emailService.sendVerificationEmail(user.email, token, user.name || undefined);

        res.json({ message: 'If the email exists, a verification link has been sent' });
    } catch (error) {
        req.log.error({ error }, 'Resend verification error');
        res.status(500).json({ error: 'Failed to send verification' });
    }
});

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email with token
 *     tags: [Auth]
 */
router.post('/verify-email', async (req, res) => {
    try {
        const data = verifyEmailSchema.parse(req.body);

        const tokenData = emailVerificationTokens.get(data.token);
        if (!tokenData || tokenData.expiresAt < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const user = await prisma.user.update({
            where: { id: tokenData.userId },
            data: { 
                emailVerified: true,
                emailVerifiedAt: new Date(),
            },
            include: { tenant: true },
        });

        emailVerificationTokens.delete(data.token);

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
            },
            getJwtSecret(),
            { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
        );

        res.json({
            message: 'Email verified successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified,
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
        req.log.error({ error }, 'Verify email error');
        res.status(500).json({ error: 'Failed to verify email' });
    }
});

/**
 * @swagger
 * /auth/oauth/google:
 *   get:
 *     summary: Initiate Google OAuth
 *     tags: [Auth]
 */
router.get('/oauth/google', (req, res) => {
    const config = getOAuthConfig('google');
    if (!config) {
        return res.status(503).json({ error: 'Google OAuth is not configured' });
    }
    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/oauth/google/callback`;
    const scope = encodeURIComponent('email profile');
    const state = crypto.randomBytes(16).toString('hex');

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;
    res.redirect(url);
});

/**
 * @swagger
 * /auth/oauth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [Auth]
 */
router.get('/oauth/google/callback', async (req, res) => {
    try {
        const config = getOAuthConfig('google');
        if (!config) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_not_configured`);
        }

        const { code } = req.query;
        if (!code) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code as string,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/oauth/google/callback`,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenResponse.json();
        if (!tokens.access_token) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_error`);
        }

        // Get user info
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const userInfo = await userInfoResponse.json();

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email: userInfo.email } });
        
        if (!user) {
            const tenant = await prisma.tenant.create({
                data: {
                    name: userInfo.name || userInfo.email,
                    slug: `google-${Date.now()}`,
                },
            });

            user = await prisma.user.create({
                data: {
                    email: userInfo.email,
                    passwordHash: crypto.randomBytes(32).toString('hex'),
                    name: userInfo.name,
                    tenantId: tenant.id,
                    role: 'ADMIN',
                    emailVerified: true,
                    emailVerifiedAt: new Date(),
                },
            });
        } else if (!user.emailVerified) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { emailVerified: true, emailVerifiedAt: new Date() },
            });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
            getJwtSecret(),
            { expiresIn: '7d' }
        );

        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (error) {
        req.log.error({ error }, 'Google OAuth error');
        res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
    }
});

/**
 * @swagger
 * /auth/oauth/github:
 *   get:
 *     summary: Initiate GitHub OAuth
 *     tags: [Auth]
 */
router.get('/oauth/github', (req, res) => {
    const config = getOAuthConfig('github');
    if (!config) {
        return res.status(503).json({ error: 'GitHub OAuth is not configured' });
    }
    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/oauth/github/callback`;
    const scope = 'user:email';
    const state = crypto.randomBytes(16).toString('hex');

    const url = `https://github.com/login/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
    res.redirect(url);
});

/**
 * @swagger
 * /auth/oauth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback
 *     tags: [Auth]
 */
router.get('/oauth/github/callback', async (req, res) => {
    try {
        const config = getOAuthConfig('github');
        if (!config) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_not_configured`);
        }

        const { code } = req.query;
        if (!code) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code as string,
            }),
        });

        const tokens = await tokenResponse.json();
        if (!tokens.access_token) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_error`);
        }

        // Get user info
        const userResponse = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const githubUser = await userResponse.json();

        // Get email
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const emails = await emailsResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email;

        if (!primaryEmail) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
        }

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email: primaryEmail } });
        
        if (!user) {
            const tenant = await prisma.tenant.create({
                data: {
                    name: githubUser.name || githubUser.login,
                    slug: `github-${Date.now()}`,
                },
            });

            user = await prisma.user.create({
                data: {
                    email: primaryEmail,
                    passwordHash: crypto.randomBytes(32).toString('hex'),
                    name: githubUser.name || githubUser.login,
                    tenantId: tenant.id,
                    role: 'ADMIN',
                    emailVerified: true,
                    emailVerifiedAt: new Date(),
                },
            });
        } else if (!user.emailVerified) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { emailVerified: true, emailVerifiedAt: new Date() },
            });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
            getJwtSecret(),
            { expiresIn: '7d' }
        );

        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (error) {
        req.log.error({ error }, 'GitHub OAuth error');
        res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
    }
});

export default router;
