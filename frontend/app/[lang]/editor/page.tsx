import { EditorCanvas } from '@/components/Editor';
import CanvasV2 from '@/components/Editor/v2/CanvasV2';
import { AccessibilityProvider } from '@/context/AccessibilityContext';
import { featureFlags } from '@/lib/featureFlags';

// useSearchParams() in EditorCanvas (for the ?id= deep-link loader)
// forces this page to render at request time. Without this, next build
// fails the prerender step because there is no Suspense boundary
// around the search-params read.
export const dynamic = 'force-dynamic';

export default async function EditorPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <AccessibilityProvider>
      <div className="h-screen w-full bg-black">
        {featureFlags.editorV2 ? <CanvasV2 lang={typedLang} /> : <EditorCanvas lang={typedLang} />}
      </div>
    </AccessibilityProvider>
  );
}
