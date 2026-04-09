import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { VisualizationProvider } from '@/context/VisualizationContext';

const inter = Inter({ subsets: ['latin'] });

// metadataBase is read at build time. The repo does not own a public
// domain yet, so we point at the GitHub Pages preview URL by default
// and let SITE_URL override it via env when (if) a real domain lands.
// Hardcoding nanorun.dev would be a lie that bites us at deploy time.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hvelizgr.github.io/NanoFlow';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'NanoRun — The action layer for your alerts',
    template: '%s · NanoRun',
  },
  description:
    "Sentry catches it at 3am. NanoRun runs the fix. Open-source visual runbooks that respond to alerts from Sentry, Datadog, GitHub, or any webhook. Self-host with one command.",
  applicationName: 'NanoRun',
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
    siteName: 'NanoRun',
    title: 'NanoRun — Sentry catches it. NanoRun runs the fix.',
    description:
      'Open-source visual runbooks that respond to your alerts. Visual to author, YAML to commit, sandboxed to execute, audited to prove.',
    locale: 'en_US',
    alternateLocale: ['es_ES'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NanoRun — Sentry catches it. NanoRun runs the fix.',
    description:
      'Open-source visual runbooks that respond to your alerts. Self-host with one command.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Inline script that runs BEFORE React hydrates. Reads theme +
// visualization prefs from localStorage and writes data-* attributes
// to <html> so the page never flashes the wrong palette / wrong
// density / wrong animation state on first paint. Mirrors the logic
// in ThemeContext + VisualizationContext (kept inline because it
// must run synchronously before any component renders).
const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('nanorun-theme');if(t!=='light'&&t!=='dark'&&t!=='midnight')t='dark';document.documentElement.setAttribute('data-theme',t);if(t!=='light')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.classList.add('dark');}try{var v=JSON.parse(localStorage.getItem('nanorun-visualization')||'{}');var html=document.documentElement;html.setAttribute('data-anim',v.animationsEnabled===false?'off':'on');html.setAttribute('data-flow',v.flowAnimationsEnabled===false?'off':'on');html.setAttribute('data-density',v.nodeDensity||'comfortable');html.setAttribute('data-line-style',v.lineStyle||'bezier');html.style.setProperty('--editor-glow',String(typeof v.glowIntensity==='number'?v.glowIntensity:1));}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <VisualizationProvider>{children}</VisualizationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
