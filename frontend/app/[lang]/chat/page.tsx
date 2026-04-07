import { ChatInterface } from '@/components/Chat';

export default async function ChatPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    return <ChatInterface lang={lang as 'en' | 'es'} />;
}
