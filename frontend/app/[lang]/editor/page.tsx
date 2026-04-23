import { EditorCanvas } from '@/components/Editor';
import EditorSidebar from '@/components/Editor/EditorSidebar';
import { AccessibilityProvider } from '@/context/AccessibilityContext';

// useSearchParams() in EditorCanvas (for the ?id= deep-link loader)
// forces this page to render at request time. Without this, next build
// fails the prerender step because there is no Suspense boundary
// around the search-params read.
export const dynamic = 'force-dynamic';

export default async function EditorPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <AccessibilityProvider>
      <div className="h-screen w-full bg-black">
        <EditorCanvas lang={lang as 'en' | 'es'} />
      </div>
    </AccessibilityProvider>
  );
}
