import EditorSidebar from '@/components/Editor/EditorSidebar';
import AppearancePage from '@/components/Settings/appearance/AppearancePage';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full bg-[var(--app-bg)] text-[var(--text-primary)]">
      <EditorSidebar lang={typedLang} />
      <AppearancePage lang={typedLang} />
    </div>
  );
}
