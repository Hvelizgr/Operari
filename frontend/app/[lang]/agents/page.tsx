import AgentsPage from '@/components/Agents/AgentsPage';
import EditorSidebar from '@/components/Editor/EditorSidebar';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <EditorSidebar lang={typedLang} />
      <AgentsPage lang={typedLang} />
    </div>
  );
}
