import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import jwt from 'jsonwebtoken';

/**
 * OAuth2/SAML Configuration per tenant
 */
interface SSOConfig {
    provider: 'google' | 'microsoft' | 'okta' | 'saml';
    clientId?: string;
    clientSecret?: string;
    issuer?: string;
    callbackUrl?: string;
    samlEntryPoint?: string;
    samlCert?: string;
}

export class SSOService {
    private static instance: SSOService;

    private constructor() {}

    public static getInstance(): SSOService {
        if (!SSOService.instance) {
            SSOService.instance = new SSOService();
        }
        return SSOService.instance;
    }

    /**
     * Get SSO config for a tenant
     */
    public async getConfig(tenantId: string): Promise<SSOConfig | null> {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { ssoConfig: true }
        });
        return tenant?.ssoConfig as SSOConfig | null;
    }

    /**
     * Generate OAuth2 authorization URL
     */
    public getAuthorizationUrl(config: SSOConfig, state: string): string {
        switch (config.provider) {
            case 'google':
                return `https://accounts.google.com/o/oauth2/v2/auth?` +
                    `client_id=${config.clientId}&` +
                    `redirect_uri=${encodeURIComponent(config.callbackUrl || '')}&` +
                    `response_type=code&` +
                    `scope=openid email profile&` +
                    `state=${state}`;

            case 'microsoft':
                return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
                    `client_id=${config.clientId}&` +
                    `redirect_uri=${encodeURIComponent(config.callbackUrl || '')}&` +
                    `response_type=code&` +
                    `scope=openid email profile&` +
                    `state=${state}`;

            case 'okta':
                return `${config.issuer}/v1/authorize?` +
                    `client_id=${config.clientId}&` +
                    `redirect_uri=${encodeURIComponent(config.callbackUrl || '')}&` +
                    `response_type=code&` +
                    `scope=openid email profile&` +
                    `state=${state}`;

            default:
                throw new Error(`Unsupported SSO provider: ${config.provider}`);
        }
    }

    /**
     * Exchange authorization code for tokens
     */
    public async exchangeCodeForTokens(config: SSOConfig, code: string): Promise<{
        email: string;
        name?: string;
        providerId: string;
    }> {
        const axios = require('axios');

        let tokenUrl: string;
        let userInfoUrl: string;

        switch (config.provider) {
            case 'google':
                tokenUrl = 'https://oauth2.googleapis.com/token';
                userInfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';
                break;
            case 'microsoft':
                tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
                userInfoUrl = 'https://graph.microsoft.com/v1.0/me';
                break;
            case 'okta':
                tokenUrl = `${config.issuer}/v1/token`;
                userInfoUrl = `${config.issuer}/v1/userinfo`;
                break;
            default:
                throw new Error(`Unsupported provider: ${config.provider}`);
        }

        // Exchange code for tokens
        const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
            code,
            client_id: config.clientId!,
            client_secret: config.clientSecret!,
            redirect_uri: config.callbackUrl!,
            grant_type: 'authorization_code'
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // Get user info
        const userResponse = await axios.get(userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userData = userResponse.data;

        return {
            email: userData.email || userData.mail,
            name: userData.name || userData.displayName,
            providerId: userData.sub || userData.id
        };
    }

    /**
     * Find or create user from SSO
     */
    public async findOrCreateUser(tenantId: string, ssoUser: {
        email: string;
        name?: string;
        providerId: string;
    }): Promise<{ user: any; isNew: boolean }> {
        let user = await prisma.user.findFirst({
            where: {
                email: ssoUser.email,
                tenantId
            }
        });

        if (user) {
            return { user, isNew: false };
        }

        // Create new user
        user = await prisma.user.create({
            data: {
                email: ssoUser.email,
                name: ssoUser.name,
                passwordHash: '', // SSO users don't have passwords
                tenantId,
                role: 'USER'
            }
        });

        return { user, isNew: true };
    }

    /**
     * Generate JWT for SSO user
     */
    public generateToken(user: any): string {
        return jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId
            },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );
    }
}

export const ssoService = SSOService.getInstance();
