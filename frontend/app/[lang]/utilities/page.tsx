import { redirect } from 'next/navigation';

// API keys, webhooks and connected accounts moved to Settings → Integrations.
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  redirect(`/${lang}/settings?tab=integrations`);
}
