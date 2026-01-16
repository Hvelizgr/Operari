import { EditorCanvas } from '@/components/Editor';
import EditorSidebar from '@/components/Editor/EditorSidebar';
import { AccessibilityProvider } from '@/context/AccessibilityContext';

export default async function EditorPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    return (
        <AccessibilityProvider>
            <div className="h-screen w-full bg-black">
                <EditorCanvas lang={lang as 'en' | 'es'} />
            </div>
        </AccessibilityProvider>
    );
}
