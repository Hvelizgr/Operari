'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Palette,
  Box as BoxIcon,
  Spline,
  Zap as ZapIcon,
  Grid3x3,
  LayoutDashboard,
  ChevronLeft,
} from 'lucide-react';
import { useVisualization } from '@/context/VisualizationContext';
import { STRINGS } from './strings';
import { TabButton } from './primitives';
import { LivePreview } from './previews';
import { NodesTab } from './tabs/NodesTab';
import { ConnectionsTab } from './tabs/ConnectionsTab';
import { FlowTab } from './tabs/FlowTab';
import { CanvasTab } from './tabs/CanvasTab';
import { PresetsTab } from './tabs/PresetsTab';

type TabId = 'nodes' | 'connections' | 'flow' | 'canvas' | 'presets';

/**
 * Shell for the Appearance page. Holds the sticky live preview + tab
 * strip and delegates each tab's controls to its own module. Every
 * tab receives the same `t` strings object — there is no per-tab
 * state owned here because all state lives in VisualizationContext.
 */
export default function AppearancePage({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const viz = useVisualization();
  const [tab, setTab] = useState<TabId>('nodes');

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <Link
            href={`/${lang}/settings`}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={12} />
            {t.backToSettings}
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
            <Palette size={22} className="text-[var(--accent-color)]" />
            {t.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{t.subtitle}</p>
        </div>

        {/* Sticky live preview + tabs — user sees combined effect
                    regardless of which tab they're in. */}
        <div className="bg-[var(--app-bg)]/95 sticky top-0 z-10 -mx-6 mb-6 px-6 pb-3 pt-2 backdrop-blur">
          <LivePreview prefs={viz} animsOn={viz.animationSpeed !== 'off'} />
          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-[var(--panel-border)]">
            <TabButton
              icon={<BoxIcon size={13} />}
              active={tab === 'nodes'}
              onClick={() => setTab('nodes')}
            >
              {t.tabNodes}
            </TabButton>
            <TabButton
              icon={<Spline size={13} />}
              active={tab === 'connections'}
              onClick={() => setTab('connections')}
            >
              {t.tabConnections}
            </TabButton>
            <TabButton
              icon={<ZapIcon size={13} />}
              active={tab === 'flow'}
              onClick={() => setTab('flow')}
            >
              {t.tabFlow}
            </TabButton>
            <TabButton
              icon={<Grid3x3 size={13} />}
              active={tab === 'canvas'}
              onClick={() => setTab('canvas')}
            >
              {t.tabCanvas}
            </TabButton>
            <TabButton
              icon={<LayoutDashboard size={13} />}
              active={tab === 'presets'}
              onClick={() => setTab('presets')}
            >
              {t.tabPresets}
            </TabButton>
          </div>
        </div>

        {tab === 'nodes' && <NodesTab t={t} />}
        {tab === 'connections' && <ConnectionsTab t={t} />}
        {tab === 'flow' && <FlowTab t={t} />}
        {tab === 'canvas' && <CanvasTab t={t} />}
        {tab === 'presets' && <PresetsTab t={t} />}
      </div>
    </div>
  );
}
