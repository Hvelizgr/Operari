import EditorSidebar from '@/components/Editor/EditorSidebar';
import SettingsPage from '@/components/Settings/SettingsPage';

export default async function Page({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const typedLang = lang as 'en' | 'es';
    return (
        <div className="h-screen w-full flex bg-[var(--app-bg)] text-[var(--text-primary)]">
            <EditorSidebar lang={typedLang} />
            <SettingsPage lang={typedLang} />
        </div>
    );
}
