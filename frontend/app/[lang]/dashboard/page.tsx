import { DashboardToasts } from '@/components/Common/DashboardToasts';
import { EmailVerifyBanner } from '@/components/Common/EmailVerifyBanner';
import { OnboardingTour } from '@/components/Common/OnboardingTour';
import { QuotaWarningBanner } from '@/components/Common/QuotaWarningBanner';
import DashboardPage from '@/components/Dashboard/DashboardPage';
import EditorSidebar from '@/components/Editor/EditorSidebar';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = lang as 'en' | 'es';
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
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
