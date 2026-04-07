import type { Metadata } from 'next';
import { content as contentEn } from './content/en';
import { content as contentEs } from './content/es';


export async function generateStaticParams() {
    return [{ lang: 'en' }, { lang: 'es' }];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang } = await params;
    const content = lang === 'es' ? contentEs : contentEn;

    return {
        title: content.seo.title,
        description: content.seo.description,
        openGraph: {
            title: content.seo.openGraph.title,
            description: content.seo.openGraph.description,
            type: 'website',
            locale: lang,
            siteName: 'NanoRun',
        },
    };
}

export default async function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
        </>
    );
}
