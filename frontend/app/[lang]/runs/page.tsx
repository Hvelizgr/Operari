import RunHistory from '@/components/Runs/RunHistory';

export default async function RunsPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    return (
        <div className="min-h-screen w-full bg-black text-white">
            <RunHistory lang={lang as 'en' | 'es'} />
        </div>
    );
}
