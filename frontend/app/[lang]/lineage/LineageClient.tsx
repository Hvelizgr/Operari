'use client';

import dynamic from 'next/dynamic';

const LineageCanvas = dynamic(() => import('@/components/Lineage/LineageCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
      Loading…
    </div>
  ),
});

export default function LineageClient({ lang }: { lang: 'en' | 'es' }) {
  return <LineageCanvas lang={lang} />;
}
