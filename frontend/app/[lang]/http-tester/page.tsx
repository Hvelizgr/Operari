import EditorSidebar from '@/components/Editor/EditorSidebar';
import HttpTesterCanvas from '@/components/HttpTester/HttpTesterCanvas';
import { AccessibilityProvider } from '@/context/AccessibilityContext';

export const dynamic = 'force-dynamic';

export default async function HttpTesterPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <AccessibilityProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
        <EditorSidebar lang={typedLang} />
        <HttpTesterCanvas lang={typedLang} />
      </div>
    </AccessibilityProvider>
  );
}
