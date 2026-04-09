import EditorSidebar from '@/components/Editor/EditorSidebar';
import MonitorsPage from '@/components/Monitors/MonitorsPage';

export default async function Page({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const typedLang = lang as 'en' | 'es';
    return (
        <div className="h-screen w-full flex bg-black text-white">
            <EditorSidebar lang={typedLang} />
            <MonitorsPage lang={typedLang} />
        </div>
    );
}
