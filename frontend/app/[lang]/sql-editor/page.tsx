import EditorSidebar from '@/components/Editor/EditorSidebar';
import SQLEditorCanvas from '@/components/SQLEditor/SQLEditorCanvas';
import { AccessibilityProvider } from '@/context/AccessibilityContext';

export const dynamic = 'force-dynamic';

export default async function SQLEditorPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <AccessibilityProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
        <EditorSidebar lang={typedLang} />
        <SQLEditorCanvas lang={typedLang} />
      </div>
    </AccessibilityProvider>
  );
}
