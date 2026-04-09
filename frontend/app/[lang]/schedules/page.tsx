import EditorSidebar from '@/components/Editor/EditorSidebar';
import SchedulesPage from '@/components/Schedules/SchedulesPage';

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
            <SchedulesPage lang={typedLang} />
        </div>
    );
}
