import { AccessibilityProvider } from '@/context/AccessibilityContext';
import SQLEditorCanvas from '@/components/SQLEditor/SQLEditorCanvas';

export const dynamic = 'force-dynamic';

export default async function SQLEditorPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    return (
        <AccessibilityProvider>
            <div className="h-screen w-full bg-black">
                <SQLEditorCanvas lang={lang as 'en' | 'es'} />
            </div>
        </AccessibilityProvider>
    );
}
