import express from 'express';
import request from 'supertest';

import {
  clearSessionCookie,
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  SESSION_COOKIE_NAME,
  setCsrfCookie,
  setSessionCookie,
} from '../../auth/session-cookie';

function makeApp() {
  const app = express();
  app.post('/login', (req, res) => {
    setSessionCookie(req, res, 'jwt-abc');
    res.json({ ok: true });
  });
  app.post('/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });
  app.post('/rotate', (req, res) => {
    setCsrfCookie(req, res, 'fixed-token');
    res.json({ ok: true });
  });
  return app;
}

describe('session-cookie CSRF companion', () => {
  it('setSessionCookie always sets a companion CSRF cookie', async () => {
    const res = await request(makeApp()).post('/login');
    const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    expect(cookies.some(c => c.startsWith(`${SESSION_COOKIE_NAME}=`))).toBe(true);
    expect(cookies.some(c => c.startsWith(`${CSRF_COOKIE_NAME}=`))).toBe(true);
  });

  it('CSRF cookie is NOT HttpOnly (JS must read it) and uses SameSite=Lax', async () => {
    const res = await request(makeApp()).post('/login');
    const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const csrf = cookies.find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`))!;
    expect(csrf.toLowerCase()).not.toContain('httponly');
    expect(csrf.toLowerCase()).toContain('samesite=lax');
  });

  it('Session cookie stays HttpOnly (unchanged)', async () => {
    const res = await request(makeApp()).post('/login');
    const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const session = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`))!;
    expect(session.toLowerCase()).toContain('httponly');
  });

  it('clearSessionCookie clears both the session and the CSRF cookie', async () => {
    const res = await request(makeApp()).post('/logout');
    const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    // Expired cookies look like `Expires=Thu, 01 Jan 1970 …`
    const session = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    const csrf = cookies.find(c => c.startsWith(`${CSRF_COOKIE_NAME}=`));
    expect(session).toBeDefined();
    expect(csrf).toBeDefined();
    expect(session!.toLowerCase()).toContain('expires=thu, 01 jan 1970');
    expect(csrf!.toLowerCase()).toContain('expires=thu, 01 jan 1970');
  });

  it('generateCsrfToken returns 43-char base64url (32 bytes of entropy)', () => {
    const t = generateCsrfToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Two consecutive calls must return different values.
    expect(t).not.toBe(generateCsrfToken());
  });
});
