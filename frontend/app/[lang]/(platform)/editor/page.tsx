import { EditorCanvas } from '@/components/Editor';
import '@/styles/editor-themes.css';

export default async function EditorPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    return (
        <div className="h-full w-full bg-black relative">
            <EditorCanvas lang={lang as 'en' | 'es'} />
        </div>
    );
}
