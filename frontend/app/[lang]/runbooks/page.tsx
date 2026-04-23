import EditorSidebar from '@/components/Editor/EditorSidebar';
import RunbooksPage from '@/components/Runbooks/RunbooksPage';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full bg-black text-white">
      <EditorSidebar lang={typedLang} />
      <RunbooksPage lang={typedLang} />
    </div>
  );
}
