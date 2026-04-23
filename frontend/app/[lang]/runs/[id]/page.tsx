import RunDetail from '@/components/Runs/RunDetail';

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  return (
    <div className="min-h-screen w-full bg-black text-white">
      <RunDetail lang={lang as 'en' | 'es'} runId={id} />
    </div>
  );
}
