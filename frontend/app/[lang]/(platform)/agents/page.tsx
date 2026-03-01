import AgentDesigner from '@/components/Agents/AgentDesigner';

export default async function AgentsPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    
    return (
        <div className="min-h-full bg-slate-50/50 dark:bg-black/20">
            <AgentDesigner />
        </div>
    );
}
