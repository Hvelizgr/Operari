'use client';

import { DefaultError } from '@/components/Common/RouteBoundaries';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DefaultError error={error} reset={reset} scope="SQL Editor" />;
}
