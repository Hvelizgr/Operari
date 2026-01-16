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
            <div className="flex h-screen w-full overflow-hidden bg-black">
                <EditorSidebar lang={lang as 'en' | 'es'} />
                <div className="flex-1 relative h-full">
                    <EditorCanvas lang={lang as 'en' | 'es'} />
                </div>
            </div>
        </AccessibilityProvider>
    );
}
