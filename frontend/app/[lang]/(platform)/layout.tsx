import EditorSidebar from '@/components/Editor/EditorSidebar';
import { AccessibilityProvider } from '@/context/AccessibilityContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';
import { EditorThemeProvider } from '@/context/EditorThemeContext';
import { KeyboardShortcutsProvider } from '@/context/KeyboardShortcutsContext';
import { WhiteLabelProvider } from '@/context/WhiteLabelContext';
import { GridPattern } from '@/components/ui/GridPattern';

export default async function PlatformLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    return (
        <AccessibilityProvider>
            <SubscriptionProvider>
                <WhiteLabelProvider>
                    <EditorThemeProvider>
                        <KeyboardShortcutsProvider>
                            <div className="flex h-screen w-full overflow-hidden bg-black text-foreground">
                                <EditorSidebar lang={lang as 'en' | 'es'} />
                                <main className="flex-1 overflow-auto relative bg-background/95">
                                    {children}
                                </main>
                            </div>
                        </KeyboardShortcutsProvider>
                    </EditorThemeProvider>
                </WhiteLabelProvider>
            </SubscriptionProvider>
        </AccessibilityProvider>
    );
}
