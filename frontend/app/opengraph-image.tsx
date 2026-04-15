import { ImageResponse } from 'next/og';
import { repo } from '@/config/repo.config';

/**
 * Default Open Graph image for the whole site.
 *
 * Next.js picks this up automatically and serves it at /opengraph-image
 * for any page that does not override it. We render it on-demand with
 * @vercel/og (built into next/og) so there is no PNG checked into the
 * repo to keep in sync with copy changes.
 *
 * Design constraints:
 *   - 1200×630, the standard OG size that Twitter / Slack / LinkedIn
 *     expect. Anything else gets cropped or stretched.
 *   - One sentence: "Your alert fires. NanoRun runs the fix." Vendor-
 *     neutral on purpose so the preview reads as "we plug into whatever
 *     monitoring you already have", not as a Sentry add-on.
 *   - Dark background with the same orange accent as the favicon and
 *     the in-app primary color, so the brand reads consistently.
 *   - No external fonts (next/og has system-font fallback). Loading
 *     a custom font here would slow the route by ~400ms per request.
 */
export const runtime = 'edge';
export const alt = 'NanoRun — Your alert fires. NanoRun runs the fix.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'radial-gradient(circle at 80% 20%, rgba(249,115,22,0.18), transparent 60%), radial-gradient(circle at 15% 90%, rgba(16,185,129,0.12), transparent 55%), #0a0a0a',
          padding: '80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: '#f97316',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(249,115,22,0.35)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div style={{ color: '#fafafa', fontSize: 38, fontWeight: 700, letterSpacing: -0.5 }}>
            NanoRun
          </div>
        </div>

        {/* Middle: the sentence */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'auto',
            marginBottom: 'auto',
          }}
        >
          <div
            style={{
              color: '#fafafa',
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            Your alert fires.
          </div>
          <div
            style={{
              color: '#f97316',
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            NanoRun runs the fix.
          </div>
          <div
            style={{
              color: 'rgba(250,250,250,0.65)',
              fontSize: 30,
              marginTop: 28,
              fontWeight: 400,
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            Open-source visual runbooks that respond to your alerts.
          </div>
        </div>

        {/* Bottom: meta strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            color: 'rgba(250,250,250,0.55)',
            fontSize: 22,
            fontFamily: 'monospace',
          }}
        >
          <span>{repo.displayHost}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>AGPL · self-host</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
