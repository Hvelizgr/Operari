import Canvas from '@/components/Editor/Canvas';
import EditorSidebar from '@/components/Editor/EditorSidebar';
import { AccessibilityProvider } from '@/context/AccessibilityContext';

// useSearchParams() inside Canvas (for the ?id= deep-link loader and
// the ?run= execution-room subscriber) forces this page to render at
// request time. Without this, next build fails the prerender step
// because there is no Suspense boundary around the search-params read.
export const dynamic = 'force-dynamic';

export default async function EditorPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <AccessibilityProvider>
      <div className="flex h-screen w-full bg-black text-white">
        <EditorSidebar lang={typedLang} />
        <div className="relative min-w-0 flex-1">
          <Canvas lang={typedLang} />
        </div>
      </div>
    </AccessibilityProvider>
  );
}
