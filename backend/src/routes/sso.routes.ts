import { Router } from 'express';
import { ssoService } from '../services/sso.service';
import { prisma } from '../server';
import crypto from 'crypto';

const router = Router();

// Store state tokens temporarily (in production, use Redis)
const stateTokens = new Map<string, { tenantSlug: string; expiresAt: number }>();

/**
 * @swagger
 * /sso/{tenantSlug}/login:
 *   get:
 *     summary: Initiate SSO login
 *     tags: [SSO]
 */
router.get('/:tenantSlug/login', async (req, res, next) => {
    try {
        const { tenantSlug } = req.params;

        const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        const config = await ssoService.getConfig(tenant.id);

        if (!config) {
            return res.status(400).json({ 
                error: 'SSO not configured',
                message: 'Single Sign-On is not enabled for this workspace'
            });
        }

        // Generate state token for CSRF protection
        const state = crypto.randomBytes(32).toString('hex');
        stateTokens.set(state, {
            tenantSlug,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        const authUrl = ssoService.getAuthorizationUrl(config, state);
        res.redirect(authUrl);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /sso/callback:
 *   get:
 *     summary: SSO callback handler (OAuth2)
 *     tags: [SSO]
 */
router.get('/callback', async (req, res, _next) => {
    try {
        const { code, state, error } = req.query;

        if (error) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=${error}`);
        }

        if (!state || !stateTokens.has(state as string)) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
        }

        const stateData = stateTokens.get(state as string)!;
        stateTokens.delete(state as string);

        if (stateData.expiresAt < Date.now()) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=state_expired`);
        }

        const tenant = await prisma.tenant.findUnique({
            where: { slug: stateData.tenantSlug }
        });

        if (!tenant) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=tenant_not_found`);
        }

        const config = await ssoService.getConfig(tenant.id);
        if (!config) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=sso_not_configured`);
        }

        // Exchange code for user info
        const ssoUser = await ssoService.exchangeCodeForTokens(config, code as string);

        // Find or create user
        const { user, isNew } = await ssoService.findOrCreateUser(tenant.id, ssoUser);

        // Generate JWT
        const token = ssoService.generateToken(user);

        // Redirect to frontend with token
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&new=${isNew}`);
    } catch (error) {
        console.error('SSO callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=sso_failed`);
    }
});

/**
 * @swagger
 * /sso/saml/callback:
 *   post:
 *     summary: SAML Assertion Consumer Service
 *     tags: [SSO]
 */
router.post('/saml/callback', async (req, res, _next) => {
    try {
        const { SAMLResponse, RelayState } = req.body;

        if (!RelayState || !stateTokens.has(RelayState)) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
        }

        const stateData = stateTokens.get(RelayState)!;
        stateTokens.delete(RelayState);

        const tenant = await prisma.tenant.findUnique({
            where: { slug: stateData.tenantSlug }
        });

        if (!tenant) return res.redirect(`${process.env.FRONTEND_URL}/login?error=tenant_not_found`);

        const config = await ssoService.getConfig(tenant.id);
        if (!config || config.provider !== 'saml') {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_provider`);
        }

        const ssoUser = await ssoService.processSAMLResponse(config, SAMLResponse);
        const { user, isNew } = await ssoService.findOrCreateUser(tenant.id, ssoUser);
        const token = ssoService.generateToken(user);

        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&new=${isNew}`);
    } catch (error) {
        console.error('SAML callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=saml_failed`);
    }
});

/**
 * @swagger
 * /sso/{tenantSlug}/ldap:
 *   post:
 *     summary: LDAP Login
 *     tags: [SSO]
 */
router.post('/:tenantSlug/ldap', async (req, res, _next) => {
    try {
        const { tenantSlug } = req.params;
        const { username, password } = req.body;

        const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug }
        });

        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const config = await ssoService.getConfig(tenant.id);
        if (!config || config.provider !== 'ldap') {
            return res.status(400).json({ error: 'LDAP not configured' });
        }

        const ssoUser = await ssoService.authenticateLDAP(config, username, password);
        const { user, isNew } = await ssoService.findOrCreateUser(tenant.id, ssoUser);
        const token = ssoService.generateToken(user);

        res.json({ token, isNew });
    } catch (error) {
        res.status(401).json({ error: 'LDAP Authentication failed' });
    }
});

/**
 * @swagger
 * /sso/{tenantSlug}/config:
 *   get:
 *     summary: Get SSO configuration status
 *     tags: [SSO]
 */
router.get('/:tenantSlug/config', async (req, res, next) => {
    try {
        const { tenantSlug } = req.params;

        const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        const config = await ssoService.getConfig(tenant.id);

        res.json({
            enabled: !!config,
            provider: config?.provider || null
        });
    } catch (error) {
        next(error);
    }
});

export default router;
