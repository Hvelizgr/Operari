import type { Socket } from 'socket.io';

import { SESSION_COOKIE_NAME } from '../auth/session-cookie';

export interface SocketUser {
  id: string;
  email: string;
  tenantId: string;
}

export interface SocketAuthDeps {
  allowedOrigins: string[];
  verifyToken(token: string): Promise<SocketUser | null>;
  /** Identity used when no credentials are sent (OPERARI_ANONYMOUS_MODE). */
  anonymousUser?: SocketUser | null;
}

export type SocketAuthResult =
  | { ok: true; user: SocketUser }
  | { ok: false; code: 'unauthorized' | 'bad_origin'; message: string };

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const raw = part.slice(eq + 1).trim();
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

export function allowedOriginsFrom(frontendUrl: string | undefined): string[] {
  return (frontendUrl ?? 'http://localhost:3000')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export async function authenticateHandshake(
  socket: Socket,
  deps: SocketAuthDeps
): Promise<SocketAuthResult> {
  const authToken = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
  const cookie = parseCookieHeader(socket.handshake.headers.cookie)[SESSION_COOKIE_NAME];
  const token = typeof authToken === 'string' && authToken ? authToken : (cookie ?? null);

  if (!token) {
    if (deps.anonymousUser) return { ok: true, user: deps.anonymousUser };
    return { ok: false, code: 'unauthorized', message: 'Not authenticated' };
  }

  // CORS does not apply to WebSocket upgrades, so a cookie-authenticated
  // handshake from another site would otherwise ride the user's session.
  if (token === cookie && !(typeof authToken === 'string' && authToken)) {
    const origin = socket.handshake.headers.origin;
    if (!origin || !deps.allowedOrigins.includes(origin)) {
      return { ok: false, code: 'bad_origin', message: 'Origin not allowed' };
    }
  }

  const user = await deps.verifyToken(token);
  if (!user) return { ok: false, code: 'unauthorized', message: 'Invalid session' };
  return { ok: true, user };
}

export function socketError(code: string, message: string): Error {
  const err = new Error(message) as Error & { data?: unknown };
  err.data = { code };
  return err;
}
