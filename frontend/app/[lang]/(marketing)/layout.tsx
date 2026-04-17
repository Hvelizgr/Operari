import { content as contentEn } from '../content/en';
import { content as contentEs } from '../content/es';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

export default async function MarketingLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const content = lang === 'es' ? contentEs : contentEn;

    return (
        <div className="marketing-shell flex flex-col min-h-screen bg-background text-foreground dark">
            <Navbar content={content.navigation} lang={lang} />
            <div className="relative z-[2] flex-1">{children}</div>
            <Footer content={content.footer} />
        </div>
    );
}
