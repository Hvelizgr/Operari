import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthRequest } from './auth.middleware';

interface IPWhitelistConfig {
    enabled: boolean;
    allowedIPs: string[];
    allowedCIDRs: string[];
}

/**
 * Middleware to check IP whitelist
 */
export const checkIPWhitelist = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const tenantId = req.user?.tenantId;
        
        if (!tenantId) {
            return next(); // No tenant, skip check
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { ipWhitelist: true }
        });

        const config = tenant?.ipWhitelist as IPWhitelistConfig | null;

        if (!config || !config.enabled) {
            return next(); // IP whitelist not enabled
        }

        const clientIP = getClientIP(req);

        if (!clientIP) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Unable to determine client IP address'
            });
        }

        // Check exact IP match
        if (config.allowedIPs.includes(clientIP)) {
            return next();
        }

        // Check CIDR ranges
        for (const cidr of config.allowedCIDRs) {
            if (isIPInCIDR(clientIP, cidr)) {
                return next();
            }
        }

        // IP not in whitelist
        console.warn(`[IPWhitelist] Blocked access from IP: ${clientIP} for tenant: ${tenantId}`);
        
        return res.status(403).json({
            error: 'Access denied',
            message: 'Your IP address is not allowed to access this workspace',
            ip: clientIP
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get client IP from request
 */
function getClientIP(req: Request): string | null {
    // Check various headers for proxied requests
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
        return ips[0].trim();
    }

    const realIP = req.headers['x-real-ip'];
    if (realIP) {
        return typeof realIP === 'string' ? realIP : realIP[0];
    }

    return req.ip || req.socket.remoteAddress || null;
}

/**
 * Check if IP is in CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = ~(Math.pow(2, 32 - parseInt(bits)) - 1);
    
    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Convert IP to number
 */
function ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
}

/**
 * Validate IP address format
 */
export function isValidIP(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) return false;
    
    const parts = ip.split('.').map(Number);
    return parts.every(part => part >= 0 && part <= 255);
}

/**
 * Validate CIDR format
 */
export function isValidCIDR(cidr: string): boolean {
    const [ip, bits] = cidr.split('/');
    if (!isValidIP(ip)) return false;
    
    const bitsNum = parseInt(bits);
    return !isNaN(bitsNum) && bitsNum >= 0 && bitsNum <= 32;
}
