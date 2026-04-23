import EditorSidebar from '@/components/Editor/EditorSidebar';
import RunHistory from '@/components/Runs/RunHistory';

export default async function RunsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full bg-black text-white">
      <EditorSidebar lang={typedLang} />
      <div className="flex-1 overflow-y-auto">
        <RunHistory lang={typedLang} />
      </div>
    </div>
  );
}
