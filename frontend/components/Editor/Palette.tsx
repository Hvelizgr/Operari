'use client';

import NodePalette from '@/components/Node/NodePalette';

import { dragChannel } from './canvas/dragChannel';

export default function Palette({ lang }: { lang: 'en' | 'es' }) {
  return <NodePalette lang={lang} onNodeDragStart={nt => dragChannel.set(nt.type)} />;
}
