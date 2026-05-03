'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

/**
 * Root error boundary for the App Router. Sentry recommends wiring
 * this file so React render errors bubble through to the SDK rather
 * than disappearing into the framework's logger.
 *
 * The boundary lives at `app/global-error.tsx` (NOT under `[lang]/`)
 * because Next.js' App Router only consults the literal `app/global-error.tsx`
 * path for unrecoverable render errors. Localised error pages are a
 * separate concern handled by per-route `error.tsx` files.
 *
 * `NextError` keeps the rendered fallback minimal — once we land in
 * here the i18n layout has already failed, so reaching back into
 * `next-intl` to translate would risk a render loop.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={500} />
      </body>
    </html>
  );
}
