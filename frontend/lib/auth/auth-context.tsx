'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { authClient, AuthError, type LoginInput, type RegisterInput } from './auth-client';
import type { AuthSession } from './types';

/**
 * Login returns the session + an optional `mfaEnrollmentRequired`
 * flag the caller (the login page) uses to redirect the user to
 * /settings/security before anything else renders. The flag comes
 * from the backend when the tenant set `mfaRequired: true` and the
 * user hasn't enrolled yet.
 */
export interface LoginResult extends AuthSession {
  mfaEnrollmentRequired?: boolean;
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<LoginResult>;
  register: (input: RegisterInput) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthSession | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function anonymousSessionIfEnabled(): AuthSession | null {
  if (process.env.NEXT_PUBLIC_NANORUN_ANONYMOUS_MODE !== 'true') return null;
  return {
    user: { id: 'anonymous', email: 'anonymous@nanorun.local', name: 'Anonymous', role: 'USER' },
    tenant: { id: 'default-tenant', name: 'Default' },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<AuthSession | null> => {
    try {
      const me = await authClient.me();
      if (mounted.current) setSession(me);
      return me;
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        const anon = anonymousSessionIfEnabled();
        if (mounted.current) setSession(anon);
        return anon;
      }
      if (mounted.current) setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => {
      if (mounted.current) setLoading(false);
    });
  }, [refresh]);

  const login = useCallback(async (input: LoginInput): Promise<LoginResult> => {
    const result = await authClient.login(input);
    const next: AuthSession = { user: result.user, tenant: result.tenant };
    if (mounted.current) setSession(next);
    return {
      ...next,
      ...(result.mfaEnrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
    };
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<AuthSession> => {
    const result = await authClient.register(input);
    const next: AuthSession = { user: result.user, tenant: result.tenant };
    if (mounted.current) setSession(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authClient.logout();
    } catch {
      // Server-side cookie clear is best-effort; we still drop the local session.
    }
    if (mounted.current) setSession(anonymousSessionIfEnabled());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, login, register, logout, refresh }),
    [session, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
