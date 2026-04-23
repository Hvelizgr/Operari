import EditorSidebar from '@/components/Editor/EditorSidebar';
import DashboardPage from '@/components/Dashboard/DashboardPage';
import { EmailVerifyBanner } from '@/components/Common/EmailVerifyBanner';
import { QuotaWarningBanner } from '@/components/Common/QuotaWarningBanner';
import { DashboardToasts } from '@/components/Common/DashboardToasts';
import { OnboardingTour } from '@/components/Common/OnboardingTour';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full bg-black text-white">
      <EditorSidebar lang={typedLang} />
      <div className="flex min-w-0 flex-1 flex-col">
        <EmailVerifyBanner lang={typedLang} />
        <QuotaWarningBanner lang={typedLang} />
        <DashboardToasts lang={typedLang} />
        <OnboardingTour lang={typedLang} />
        <DashboardPage lang={typedLang} />
      </div>
    </div>
  );
}
