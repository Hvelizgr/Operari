import ApprovalInbox from '@/components/Inbox/ApprovalInbox';

export default async function InboxPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    return (
        <div className="min-h-screen w-full bg-black text-white">
            <ApprovalInbox lang={lang as 'en' | 'es'} />
        </div>
    );
}
