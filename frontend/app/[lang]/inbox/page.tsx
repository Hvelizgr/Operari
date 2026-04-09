import EditorSidebar from '@/components/Editor/EditorSidebar';
import ApprovalInbox from '@/components/Inbox/ApprovalInbox';

export default async function InboxPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const typedLang = lang as 'en' | 'es';
    return (
        <div className="h-screen w-full flex bg-black text-white">
            <EditorSidebar lang={typedLang} />
            <div className="flex-1 overflow-y-auto">
                <ApprovalInbox lang={typedLang} />
            </div>
        </div>
    );
}
