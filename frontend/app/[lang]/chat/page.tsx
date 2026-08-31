import { ChatInterface } from '@/components/Chat';
import EditorSidebar from '@/components/Editor/EditorSidebar';

// useSearchParams() in ChatInterface forces this page to render at
// request time. Without this, next build fails with a prerender error
// because there is no Suspense boundary around the search-params read.
export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <EditorSidebar lang={typedLang} />
      <ChatInterface lang={typedLang} />
    </div>
  );
}
