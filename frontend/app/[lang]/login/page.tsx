import { Suspense } from 'react';
import { GridPattern } from "@/components/ui/GridPattern";
import LoginContent from "@/components/Auth/LoginContent";

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-black/95 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <GridPattern
                    width={50}
                    height={50}
                    x={-1}
                    y={-1}
                    strokeDasharray="4 2"
                    className="stroke-blue-500/10 [mask-image:radial-gradient(1000px_circle_at_center,white,transparent)]"
                />
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
            </div>

            <Suspense fallback={<div>Loading...</div>}>
                <LoginContent lang={lang} />
            </Suspense>
        </div>
    );
}
