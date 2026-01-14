import { content as contentEn } from '../content/en';
import { content as contentEs } from '../content/es';
import Hero from './components/Hero';
import Features from './components/Features';
import EditorSimulation from './components/EditorSimulation';
import Integrations from './components/Integrations';
import UseCases from './components/UseCases';
import HowItWorks from './components/HowItWorks';
import Testimonials from './components/Testimonials';
import CTA from './components/CTA';
import Footer from './components/Footer';

export async function generateStaticParams() {
    return [{ lang: 'en' }, { lang: 'es' }];
}

export default async function Page({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const content = lang === 'es' ? contentEs : contentEn;

    return (
        <main className="flex-1 bg-background selection:bg-primary/20">
            <Hero content={content.hero} modalContent={content.modal} />

            <Features content={content.features} />

            <EditorSimulation content={content.editor} />

            <Integrations content={content.integrations} />

            <UseCases content={content.useCases} />

            <HowItWorks content={content.howItWorks} />

            <Testimonials content={content.testimonials} />

            <CTA content={content.cta} modalContent={content.modal} />

            <Footer content={content.footer} />
        </main>
    );
}
