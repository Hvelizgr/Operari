import {
  buildAuthorizeUrl,
  exchangeCode,
  newState,
  resolveOAuthUser,
} from '../../auth/oauth/oauth-service';
import { PROVIDERS } from '../../auth/oauth/providers';

/**
 * These tests lock the OAuth flow contract without talking to Google
 * or GitHub. The authorize URL shape and the linking rules are the
 * two places where a regression could silently re-open security
 * issues (no state → CSRF, wrong linking → account hijack), so they
 * get their own dedicated file.
 */

describe('newState', () => {
  it('returns a fresh url-safe random string each call', () => {
    const a = newState();
    const b = newState();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(16);
  });
});

describe('buildAuthorizeUrl', () => {
  const REDIRECT = 'https://api.cairn.run/api/auth/google/callback';

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'google-id';
    process.env.GITHUB_CLIENT_ID = 'github-id';
  });

  it('builds a google authorize URL with the right params', () => {
    const url = new URL(buildAuthorizeUrl(PROVIDERS.google, REDIRECT, 'state-123'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('google-id');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual(
      expect.arrayContaining(['openid', 'email', 'profile'])
    );
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('builds a github authorize URL with allow_signup', () => {
    const url = new URL(buildAuthorizeUrl(PROVIDERS.github, REDIRECT, 's'));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('github-id');
    expect(url.searchParams.get('allow_signup')).toBe('true');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual(
      expect.arrayContaining(['read:user', 'user:email'])
    );
  });

  it('throws when the provider is not configured', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() => buildAuthorizeUrl(PROVIDERS.google, REDIRECT, 's')).toThrow(/not configured/);
  });
});

describe('exchangeCode', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'gid';
    process.env.GOOGLE_CLIENT_SECRET = 'gsec';
  });

  it('exchanges the code and fetches userinfo', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (url === PROVIDERS.google.tokenUrl) {
        return new Response(JSON.stringify({ access_token: 'tok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === PROVIDERS.google.userInfoUrl) {
        return new Response(
          JSON.stringify({ sub: 'g-user-1', email: 'jane@example.com', name: 'Jane' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;

    const profile = await exchangeCode(
      PROVIDERS.google,
      'auth-code',
      'https://api.test/api/auth/google/callback',
      { fetchImpl }
    );

    expect(profile).toEqual({
      providerId: 'g-user-1',
      email: 'jane@example.com',
      name: 'Jane',
    });
  });

  it('throws when the token endpoint 4xxs', async () => {
    const fetchImpl = jest.fn(
      async () => new Response('bad code', { status: 400 })
    ) as unknown as typeof fetch;
    await expect(exchangeCode(PROVIDERS.google, 'c', 'r', { fetchImpl })).rejects.toThrow(
      /token exchange failed: 400/
    );
  });
});

describe('resolveOAuthUser', () => {
  function prismaStub() {
    const state: {
      oauthAccount: { provider: string; providerId: string; userId: string }[];
      users: Array<{
        id: string;
        email: string;
        name: string | null;
        role: string;
        tenantId: string;
      }>;
      tenants: Array<{ id: string; name: string; slug: string }>;
    } = { oauthAccount: [], users: [], tenants: [] };

    return {
      state,
      prisma: {
        oAuthAccount: {
          findUnique: jest.fn(
            async (args: {
              where: { provider_providerId: { provider: string; providerId: string } };
            }) => {
              const { provider, providerId } = args.where.provider_providerId;
              const row = state.oauthAccount.find(
                r => r.provider === provider && r.providerId === providerId
              );
              if (!row) return null;
              const user = state.users.find(u => u.id === row.userId);
              return { ...row, user };
            }
          ),
          create: jest.fn(
            async (args: { data: { provider: string; providerId: string; userId: string } }) => {
              state.oauthAccount.push({ ...args.data });
              return { id: 'oa-1', ...args.data };
            }
          ),
        },
        user: {
          findUnique: jest.fn(async (args: { where: { email: string } }) => {
            return state.users.find(u => u.email === args.where.email) ?? null;
          }),
          create: jest.fn(
            async (args: {
              data: {
                email: string;
                name: string | null;
                role: string;
                tenantId: string;
                oauthAccounts?: { create: { provider: string; providerId: string } };
              };
            }) => {
              const user = {
                id: `u-${state.users.length + 1}`,
                email: args.data.email,
                name: args.data.name,
                role: args.data.role,
                tenantId: args.data.tenantId,
              };
              state.users.push(user);
              if (args.data.oauthAccounts?.create) {
                state.oauthAccount.push({
                  ...args.data.oauthAccounts.create,
                  userId: user.id,
                });
              }
              return user;
            }
          ),
        },
        tenant: {
          create: jest.fn(async (args: { data: { name: string; slug: string } }) => {
            const tenant = { id: `t-${state.tenants.length + 1}`, ...args.data };
            state.tenants.push(tenant);
            return tenant;
          }),
        },
      } as unknown as Parameters<typeof resolveOAuthUser>[0],
    };
  }

  it('creates a new tenant + user + oauth account on first sign-in', async () => {
    const { prisma, state } = prismaStub();
    const result = await resolveOAuthUser(
      prisma,
      { providerId: 'g-1', email: 'jane@example.com', name: 'Jane' },
      'google'
    );
    expect(state.tenants).toHaveLength(1);
    expect(state.users).toHaveLength(1);
    expect(state.oauthAccount).toHaveLength(1);
    expect(result.email).toBe('jane@example.com');
  });

  it('links a new oauth account to an existing user with matching email', async () => {
    const { prisma, state } = prismaStub();
    state.tenants.push({ id: 't-existing', name: 'T', slug: 't' });
    state.users.push({
      id: 'u-existing',
      email: 'jane@example.com',
      name: 'Jane',
      role: 'ADMIN',
      tenantId: 't-existing',
    });

    const result = await resolveOAuthUser(
      prisma,
      { providerId: 'g-1', email: 'jane@example.com', name: 'Jane' },
      'google'
    );

    expect(result.userId).toBe('u-existing');
    expect(state.tenants).toHaveLength(1); // no new tenant
    expect(state.users).toHaveLength(1); // no duplicate user
    expect(state.oauthAccount).toEqual([
      { provider: 'google', providerId: 'g-1', userId: 'u-existing' },
    ]);
  });

  it('reuses the linked user on repeat sign-in without creating another account row', async () => {
    const { prisma, state } = prismaStub();
    state.tenants.push({ id: 't', name: 'T', slug: 't' });
    state.users.push({
      id: 'u-1',
      email: 'jane@example.com',
      name: 'Jane',
      role: 'ADMIN',
      tenantId: 't',
    });
    state.oauthAccount.push({ provider: 'google', providerId: 'g-1', userId: 'u-1' });

    const result = await resolveOAuthUser(
      prisma,
      { providerId: 'g-1', email: 'jane@example.com', name: 'Jane' },
      'google'
    );

    expect(result.userId).toBe('u-1');
    expect(state.oauthAccount).toHaveLength(1);
    expect(state.users).toHaveLength(1);
  });

  it('rejects profiles without an email', async () => {
    const { prisma } = prismaStub();
    await expect(
      resolveOAuthUser(prisma, { providerId: 'g-1', email: null, name: 'Jane' }, 'google')
    ).rejects.toThrow(/no email/);
  });
});
