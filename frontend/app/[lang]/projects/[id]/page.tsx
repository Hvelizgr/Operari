import EditorSidebar from '@/components/Editor/EditorSidebar';
import ProjectDetailPage from '@/components/Projects/ProjectDetailPage';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <EditorSidebar lang={typedLang} />
      <ProjectDetailPage lang={typedLang} projectId={id} />
    </div>
  );
}