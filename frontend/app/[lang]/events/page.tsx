import EditorSidebar from '@/components/Editor/EditorSidebar';
import EventsPage from '@/components/Events/EventsPage';

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
            <EventsPage lang={typedLang} />
        </div>
    );
}
