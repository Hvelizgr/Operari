import EditorSidebar from '@/components/Editor/EditorSidebar';
import HttpTesterCanvas from '@/components/HttpTester/HttpTesterCanvas';
import { AccessibilityProvider } from '@/context/AccessibilityContext';

export const dynamic = 'force-dynamic';

export default async function HttpTesterPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <AccessibilityProvider>
      <div className="flex h-screen w-full bg-black text-white">
        <EditorSidebar lang={typedLang} />
        <div className="relative min-w-0 flex-1">
          <HttpTesterCanvas lang={typedLang} />
        </div>
      </div>
    </AccessibilityProvider>
  );
}
