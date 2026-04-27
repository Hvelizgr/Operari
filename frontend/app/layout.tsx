import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { QuotaExceededModal, QuotaInterceptor } from '@/components/Common/QuotaExceededModal';
import { ThemeProvider } from '@/context/ThemeContext';
import { themeBootstrapScript } from '@/context/visualization/bootstrap';
import { VisualizationProvider } from '@/context/VisualizationContext';
import { AuthProvider } from '@/lib/auth';

const inter = Inter({ subsets: ['latin'] });

// metadataBase is read at build time. The repo does not own a public
// domain yet, so the dev fallback is localhost — any production deploy
// MUST set NEXT_PUBLIC_SITE_URL to its real origin (otherwise OG image
// URLs and social previews will resolve against localhost and break).
// Hardcoding operari.dev would be a lie that bites us at deploy time.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Operari — The action layer for your alerts',
    template: '%s · Operari',
  },
  description:
    'Your alert fires at 3am. Operari runs the fix. Open-source visual runbooks triggered by Datadog, Sentry, GitHub, PagerDuty, Grafana, or any webhook. Self-host with one command.',
  applicationName: 'Operari',
  authors: [{ name: 'Héctor Eduardo Véliz Girón' }],
  keywords: [
    'runbook',
    'sre',
    'platform engineering',
    'incident response',
    'sentry',
    'datadog',
    'open source',
    'devops automation',
    'oncall',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Operari',
    title: 'Operari — Your alert fires. Operari runs the fix.',
    description:
      'Open-source visual runbooks that respond to your alerts. Visual to author, YAML to commit, sandboxed to execute, audited to prove.',
    locale: 'en_US',
    alternateLocale: ['es_ES'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Operari — Your alert fires. Operari runs the fix.',
    description:
      'Open-source visual runbooks that respond to your alerts. Self-host with one command.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <VisualizationProvider>
            <AuthProvider>
              <QuotaInterceptor />
              {/* Default to English for the modal; the locale-aware
                  routes wrap their own tree but the interceptor has
                  to live at the root layout so every fetch is wrapped
                  regardless of which subtree made the call. */}
              <QuotaExceededModal lang="en" />
              {children}
            </AuthProvider>
          </VisualizationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
