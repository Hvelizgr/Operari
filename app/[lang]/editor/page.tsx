import EditorCanvas from '@/components/EditorCanvas';
import { AccessibilityProvider } from '@/context/AccessibilityContext';

export default async function EditorPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    return (
        <AccessibilityProvider>
            <EditorCanvas lang={lang as 'en' | 'es'} />
        </AccessibilityProvider>
    );
}
