import { randomBytes } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'nanorun_session';
export const CSRF_COOKIE_NAME = 'nanorun_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The Secure flag decision.
 *
 * We can't key off NODE_ENV because our docker-compose sets it to
 * `production` while still serving the app over plain HTTP on
 * `localhost:3000`. Marking cookies Secure in that case would make the
 * browser silently refuse to send them, breaking every authed request.
 *
 * The correct signal is the *actual* request protocol: if the client
 * reached us over HTTPS (directly or via a TLS-terminating proxy that
 * sets X-Forwarded-Proto), the cookie must be Secure. Otherwise it
 * can't be. An explicit `COOKIE_SECURE=true` env var overrides this
 * for operators who want to force it (e.g. behind a proxy that strips
 * the header).
 */
function isSecureRequest(req: Request): boolean {
    if (process.env.COOKIE_SECURE === 'true') return true;
    if (process.env.COOKIE_SECURE === 'false') return false;
    if (req.secure) return true;
    const forwardedProto = req.get('x-forwarded-proto');
    return forwardedProto === 'https';
}

function baseOptions(req: Request): CookieOptions {
    return {
        httpOnly: true,
        secure: isSecureRequest(req),
        sameSite: 'lax',
        path: '/',
    };
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
    res.cookie(SESSION_COOKIE_NAME, token, {
        ...baseOptions(req),
        maxAge: SEVEN_DAYS_MS,
    });
    // Double-submit CSRF: mint a new token alongside every session
    // cookie rotation so the frontend always has a fresh value to
    // echo into the X-CSRF-Token header. Pairing the two mints
    // here (rather than at each call site) makes it impossible to
    // add a new login path that forgets the CSRF cookie.
    setCsrfCookie(req, res);
}

export function clearSessionCookie(req: Request, res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME, baseOptions(req));
    res.clearCookie(CSRF_COOKIE_NAME, csrfOptions(req));
}

/**
 * CSRF cookie options. Mirrors the session cookie's SameSite/Secure
 * treatment but keeps HttpOnly OFF on purpose — the whole point of
 * double-submit is that JavaScript can read this value and echo it
 * into a header. An attacker on a foreign origin can't forge the
 * header because browsers refuse to leak cookies cross-origin via
 * CORS unless the server explicitly allows it + SameSite=Lax
 * already blocks the cookie from being attached to the cross-site
 * POST in the first place. Two independent guards, one attacker has
 * to defeat both.
 */
function csrfOptions(req: Request): CookieOptions {
    return {
        httpOnly: false,
        secure: isSecureRequest(req),
        sameSite: 'lax',
        path: '/',
    };
}

/**
 * Generate a fresh CSRF token. 32 bytes of crypto randomness →
 * 43 char base64url. Callers don't store it server-side — the double
 * submit pattern compares the header to the cookie, so the token
 * never leaves the browser after it's set.
 */
export function generateCsrfToken(): string {
    return randomBytes(32).toString('base64url');
}

/**
 * Issue a CSRF token alongside the session. Call this immediately
 * after setSessionCookie() on every successful login/register/
 * refresh/oauth-callback/invite-accept — anywhere a new session
 * cookie is minted.
 */
export function setCsrfCookie(req: Request, res: Response, token?: string): string {
    const csrf = token ?? generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, csrf, {
        ...csrfOptions(req),
        maxAge: SEVEN_DAYS_MS,
    });
    return csrf;
}
