import EditorSidebar from '@/components/Editor/EditorSidebar';
import AgentsPage from '@/components/Agents/AgentsPage';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full bg-black text-white">
      <EditorSidebar lang={typedLang} />
      <AgentsPage lang={typedLang} />
    </div>
  );
}
