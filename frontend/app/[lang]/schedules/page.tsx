import EditorSidebar from '@/components/Editor/EditorSidebar';
import SchedulesPage from '@/components/Schedules/SchedulesPage';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <EditorSidebar lang={typedLang} />
      <SchedulesPage lang={typedLang} />
    </div>
  );
}
