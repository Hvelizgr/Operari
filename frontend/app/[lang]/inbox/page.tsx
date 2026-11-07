import EditorSidebar from '@/components/Editor/EditorSidebar';
import ApprovalInbox from '@/components/Inbox/ApprovalInbox';

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ approval?: string }>;
}) {
  const { lang } = await params;
  const { approval } = await searchParams;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <EditorSidebar lang={typedLang} />
      <div className="flex-1 overflow-y-auto">
        <ApprovalInbox lang={typedLang} focusId={approval} />
      </div>
    </div>
  );
}
