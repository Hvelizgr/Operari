import HttpTesterCanvas from '@/components/HttpTester/HttpTesterCanvas';
import { AccessibilityProvider } from '@/context/AccessibilityContext';

export const dynamic = 'force-dynamic';

export default async function HttpTesterPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <AccessibilityProvider>
      <div className="h-screen w-full bg-black">
        <HttpTesterCanvas lang={lang as 'en' | 'es'} />
      </div>
    </AccessibilityProvider>
  );
}
