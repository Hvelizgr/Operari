import EditorSidebar from '@/components/Editor/EditorSidebar';

import LineageClient from './LineageClient';

export const dynamicParams = false;
export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'es' }];
}

export default async function LineagePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full bg-zinc-950 text-white">
      <EditorSidebar lang={typedLang} />
      <div className="relative min-w-0 flex-1">
        <LineageClient lang={typedLang} />
      </div>
    </div>
  );
}
