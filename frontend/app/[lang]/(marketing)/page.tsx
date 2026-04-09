import { content as contentEn } from '../content/en';
import { content as contentEs } from '../content/es';
import Hero from './components/Hero';
import Story from './components/Story';
import Templates from './components/Templates';
import TriggerSources from './components/TriggerSources';
import Comparison from './components/Comparison';
import CTA from './components/CTA';
import Footer from './components/Footer';

export async function generateStaticParams() {
    return [{ lang: 'en' }, { lang: 'es' }];
}

/**
 * Marketing landing — six sections, one narrative.
 *
 *   Hero          → "Your alert fires. NanoRun runs the fix." +
 *                   live alert→runbook scenario card
 *   Story         → 01 author / 02 commit / 03 respond, with stylized
 *                   editor / yaml-diff / run-timeline mockups
 *   Templates     → 4 real .yaml templates from /templates, each card
 *                   linking to the file on GitHub. Replaces the old
 *                   EditorSimulation (which was visually out of step
 *                   with the new design and used CRUD-app snippets).
 *   TriggerSrcs   → Sentry / Datadog / GitHub / webhook cards +
 *                   "every step calls real tools" strip
 *   Comparison    → honest table vs Rundeck / StackStorm / incident.io
 *                   / Backstage, with explicit losses
 *   CTA           → docker compose snippet + README + "what does NOT
 *                   work yet" links
 */
export default async function Page({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const content = lang === 'es' ? contentEs : contentEn;

    return (
        <main className="flex-1 bg-background selection:bg-primary/20">
            <Hero content={content.hero} />

            <div id="story">
                <Story content={content.story} />
            </div>

            <div id="templates">
                <Templates content={content.templates} />
            </div>

            <div id="triggers">
                <TriggerSources content={content.triggers} />
            </div>

            <div id="compare">
                <Comparison content={content.comparison} />
            </div>

            <div id="self-host">
                <CTA content={content.cta} />
            </div>

            <Footer content={content.footer} />
        </main>
    );
}
