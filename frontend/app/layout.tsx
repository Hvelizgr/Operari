import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { VisualizationProvider } from '@/context/VisualizationContext';
import { AuthProvider } from '@/lib/auth';
import { QuotaExceededModal, QuotaInterceptor } from '@/components/Common/QuotaExceededModal';

const inter = Inter({ subsets: ['latin'] });

// metadataBase is read at build time. The repo does not own a public
// domain yet, so the dev fallback is localhost — any production deploy
// MUST set NEXT_PUBLIC_SITE_URL to its real origin (otherwise OG image
// URLs and social previews will resolve against localhost and break).
// Hardcoding nanorun.dev would be a lie that bites us at deploy time.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'NanoRun — The action layer for your alerts',
    template: '%s · NanoRun',
  },
  description:
    "Your alert fires at 3am. NanoRun runs the fix. Open-source visual runbooks triggered by Datadog, Sentry, GitHub, PagerDuty, Grafana, or any webhook. Self-host with one command.",
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
    title: 'NanoRun — Your alert fires. NanoRun runs the fix.',
    description:
      'Open-source visual runbooks that respond to your alerts. Visual to author, YAML to commit, sandboxed to execute, audited to prove.',
    locale: 'en_US',
    alternateLocale: ['es_ES'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NanoRun — Your alert fires. NanoRun runs the fix.',
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
const themeBootstrapScript = `(function(){
try{var t=localStorage.getItem('nanorun-theme');if(t!=='light'&&t!=='dark'&&t!=='midnight')t='dark';document.documentElement.setAttribute('data-theme',t);if(t!=='light')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.classList.add('dark');}
try{
var v=JSON.parse(localStorage.getItem('nanorun-visualization')||'{}');
var html=document.documentElement;
// Derive animationSpeed from legacy animationsEnabled for first-paint compat.
var speed=v.animationSpeed||(v.animationsEnabled===false?'off':'default');
var mult=({off:0,calm:1.5,default:1,lively:0.6})[speed]||1;
var accent=v.accentColor||'emerald';
var accentHex=({emerald:'#3ecf8e',sky:'#0ea5e9',violet:'#8b5cf6',amber:'#f59e0b',rose:'#f43f5e',slate:'#64748b'})[accent]||'#3ecf8e';
html.setAttribute('data-anim',speed==='off'?'off':'on');
html.setAttribute('data-anim-speed',speed);
html.setAttribute('data-flow',v.flowAnimationsEnabled===false?'off':'on');
html.setAttribute('data-density',v.nodeDensity||'comfortable');
html.setAttribute('data-node-style',v.nodeStyle||'modern');
html.setAttribute('data-line-style',v.lineStyle||'bezier');
html.setAttribute('data-flow-style',v.flowStyle||'orbs');
html.setAttribute('data-accent',accent);
html.style.setProperty('--editor-glow',String(typeof v.glowIntensity==='number'?v.glowIntensity:1));
html.style.setProperty('--anim-duration-mult',String(mult));
html.style.setProperty('--accent-override',accentHex);
}catch(e){}
})();`;

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
