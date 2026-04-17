import EditorSidebar from '@/components/Editor/EditorSidebar';
import DashboardPage from '@/components/Dashboard/DashboardPage';
import { EmailVerifyBanner } from '@/components/Common/EmailVerifyBanner';
import { QuotaWarningBanner } from '@/components/Common/QuotaWarningBanner';
import { DashboardToasts } from '@/components/Common/DashboardToasts';
import { OnboardingTour } from '@/components/Common/OnboardingTour';

export default async function Page({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const typedLang = lang as 'en' | 'es';
    return (
        <div className="h-screen w-full flex bg-black text-white">
            <EditorSidebar lang={typedLang} />
            <div className="flex flex-col flex-1 min-w-0">
                <EmailVerifyBanner lang={typedLang} />
                <QuotaWarningBanner lang={typedLang} />
                <DashboardToasts lang={typedLang} />
                <OnboardingTour lang={typedLang} />
                <DashboardPage lang={typedLang} />
            </div>
        </div>
    );
}
