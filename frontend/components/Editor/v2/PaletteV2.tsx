'use client';

import NodePalette from '@/components/Node/NodePalette';

import { dragChannel } from './dragChannel';

export default function PaletteV2({ lang }: { lang: 'en' | 'es' }) {
  return <NodePalette lang={lang} onNodeDragStart={nt => dragChannel.set(nt.type)} />;
}
