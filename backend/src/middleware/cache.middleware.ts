import { Request, Response, NextFunction } from 'express';

export interface CacheOptions {
    maxAge?: number;
    staleWhileRevalidate?: number;
    private?: boolean;
    noCache?: boolean;
}

export function cacheControl(options: CacheOptions = {}) {
    return (_req: Request, res: Response, next: NextFunction) => {
        if (options.noCache) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            return next();
        }

        const directives: string[] = [];
        
        if (options.private) {
            directives.push('private');
        } else {
            directives.push('public');
        }
        
        if (options.maxAge !== undefined) {
            directives.push(`max-age=${options.maxAge}`);
        }
        
        if (options.staleWhileRevalidate !== undefined) {
            directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
        }

        if (directives.length > 0) {
            res.setHeader('Cache-Control', directives.join(', '));
        }

        next();
    };
}

export const cachePresets = {
    noCache: cacheControl({ noCache: true }),
    short: cacheControl({ maxAge: 60, staleWhileRevalidate: 120 }),
    medium: cacheControl({ maxAge: 300, staleWhileRevalidate: 600 }),
    long: cacheControl({ maxAge: 3600, staleWhileRevalidate: 7200 }),
    privateShort: cacheControl({ maxAge: 60, staleWhileRevalidate: 120, private: true }),
};
