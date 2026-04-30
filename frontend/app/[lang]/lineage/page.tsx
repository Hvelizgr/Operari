import LineageClient from './LineageClient';

export const dynamicParams = false;
export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'es' }];
}

export default async function LineagePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <div className="h-screen w-full bg-zinc-950">
      <LineageClient lang={lang as 'en' | 'es'} />
    </div>
  );
}
