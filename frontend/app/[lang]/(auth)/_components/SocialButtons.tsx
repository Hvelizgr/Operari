'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Github } from 'lucide-react';
import type { AuthLang } from '../strings';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

interface SocialButtonsProps {
  lang: AuthLang;
  googleEnabled?: boolean;
  githubEnabled?: boolean;
  dividerLabel: string;
  google: string;
  github: string;
}

export function SocialButtons({
  lang,
  googleEnabled,
  githubEnabled,
  dividerLabel,
  google,
  github,
}: SocialButtonsProps) {
  const pathname = usePathname() ?? `/${lang}/login`;
  const searchParams = useSearchParams();
  // Preserve the original `?redirect=` so the OAuth callback can
  // land the user back where they tried to go. Default to the
  // current page's lang-scoped dashboard.
  const redirectParam = searchParams.get('redirect');
  const returnTo =
    redirectParam ?? (pathname.startsWith('/es') ? '/es/dashboard' : '/en/dashboard');
  const href = (provider: 'google' | 'github') =>
    `/api/auth/${provider}?redirect=${encodeURIComponent(returnTo)}`;

  if (!googleEnabled && !githubEnabled) return null;

  return (
    <div className="mt-6">
      <div className="relative my-5 flex items-center">
        <span className="bg-border/50 h-px flex-1" />
        <span className="text-muted-foreground px-3 font-mono text-[10px] uppercase tracking-widest">
          {dividerLabel}
        </span>
        <span className="bg-border/50 h-px flex-1" />
      </div>
      <div className="space-y-2">
        {googleEnabled && (
          <a
            href={href('google')}
            className="border-border/70 bg-background/60 hover:bg-background/90 hover:border-primary/40 text-foreground/90 flex h-11 w-full items-center justify-center gap-3 rounded-lg border text-sm font-medium transition-colors"
          >
            <GoogleIcon className="h-5 w-5" />
            {google}
          </a>
        )}
        {githubEnabled && (
          <a
            href={href('github')}
            className="border-border/70 bg-background/60 hover:bg-background/90 hover:border-primary/40 text-foreground/90 flex h-11 w-full items-center justify-center gap-3 rounded-lg border text-sm font-medium transition-colors"
          >
            <Github className="h-5 w-5" />
            {github}
          </a>
        )}
      </div>
    </div>
  );
}
