import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

const LOCALES = ['en', 'es'] as const;
const DEFAULT_LOCALE = 'en';

/**
 * Top-level route segments (after the locale prefix) that require a
 * valid session. Marketing, auth, and docs pages are NOT here — they
 * stay publicly reachable.
 */
const PROTECTED_SEGMENTS = new Set([
  'admin',
  'agents',
  'chat',
  'dashboard',
  'editor',
  'events',
  'http-tester',
  'mcp-tester',
  'inbox',
  'monitors',
  'projects',
  'runbooks',
  'runs',
  'sessions',
  'schedules',
  'settings',
  'sql-editor',
  'utilities',
]);

const SESSION_COOKIE = 'operari_session';

const intlMiddleware = createIntlMiddleware({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
});

function isProtectedPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return false;
  const [maybeLocale, firstSegment] = segments;
  if (!LOCALES.includes(maybeLocale as (typeof LOCALES)[number])) return false;
  return PROTECTED_SEGMENTS.has(firstSegment);
}

export default function middleware(request: NextRequest) {
  // Anonymous mode short-circuits every guard — matches backend
  // anonymousFallback so self-host keeps working without login.
  const anonymousMode = process.env.NEXT_PUBLIC_OPERARI_ANONYMOUS_MODE === 'true';

  if (!anonymousMode && isProtectedPath(request.nextUrl.pathname)) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      const segments = request.nextUrl.pathname.split('/').filter(Boolean);
      const locale = (LOCALES as readonly string[]).includes(segments[0])
        ? segments[0]
        : DEFAULT_LOCALE;
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = `/${locale}/login`;
      loginUrl.search = '';
      const redirectTarget = request.nextUrl.pathname + request.nextUrl.search;
      loginUrl.searchParams.set('redirect', redirectTarget);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(es|en)/:path*'],
};
