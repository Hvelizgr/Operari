import type { AuthErrorBody, AuthSession } from './types';

/**
 * Read the double-submit CSRF cookie minted by the backend alongside
 * `nanorun_session`. The cookie is NOT HttpOnly on purpose — the
 * whole point of the pattern is that JavaScript echoes the value
 * into a header that an off-origin attacker can't forge. Returns
 * `null` during SSR (no document) or before the user has logged in.
 */
export function csrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)nanorun_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function withCsrfHeader(init?: RequestInit): RequestInit {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (SAFE_METHODS.has(method)) return init ?? {};
  const token = csrfToken();
  if (!token) return init ?? {};
  return {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'X-CSRF-Token': token,
    },
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: AuthErrorBody['error'],
    /**
     * Extra hint for login-specific failure modes. Present when
     * the backend returned `{ mfaRequired: true }` alongside a
     * 401 — the login form uses this to switch to the two-step
     * TOTP UX without prompting for the password again.
     */
    readonly mfaRequired?: boolean
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const withCsrf = withCsrfHeader(init);
  const res = await fetch(path, {
    ...withCsrf,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(withCsrf.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const err = (body as Partial<AuthErrorBody>)?.error;
    const message =
      typeof err === 'string'
        ? err
        : Array.isArray(err) && err[0]?.message
          ? err[0].message
          : res.statusText || 'Request failed';
    const mfaRequired = Boolean((body as { mfaRequired?: boolean } | null)?.mfaRequired);
    throw new AuthError(message, res.status, err, mfaRequired);
  }

  return body as T;
}

export interface RegisterInput {
  email: string;
  password: string;
  tenantName: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  /** TOTP code — only sent when MFA is enabled on the account. */
  totpCode?: string;
}

interface AuthSuccessResponse {
  user: AuthSession['user'];
  tenant: AuthSession['tenant'];
  token: string;
  /** Set by the backend when the tenant has `mfaRequired: true`
   *  and this user has not enrolled TOTP yet. The UI must route
   *  them to /settings/security on receipt so they enroll before
   *  they try to do anything else. */
  mfaEnrollmentRequired?: boolean;
}

export const authClient = {
  register(input: RegisterInput): Promise<AuthSuccessResponse> {
    return request<AuthSuccessResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  login(input: LoginInput): Promise<AuthSuccessResponse> {
    return request<AuthSuccessResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/logout', { method: 'POST' });
  },
  me(): Promise<AuthSession> {
    return request<AuthSession>('/api/auth/me');
  },
  forgotPassword(email: string): Promise<void> {
    return request<void>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(token: string, password: string): Promise<AuthSuccessResponse> {
    return request<AuthSuccessResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
  changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  resendVerification(): Promise<void> {
    return request<void>('/api/auth/send-verification', { method: 'POST' });
  },
};
