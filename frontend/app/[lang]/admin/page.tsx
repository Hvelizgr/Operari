import { redirect } from 'next/navigation';

// The workspace overview moved to Settings → Workspace.
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  redirect(`/${lang}/settings?tab=workspace`);
}
