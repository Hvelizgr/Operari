import AnalyticsDashboard from "@/components/Analytics/AnalyticsDashboard";

export default async function AnalyticsPage(props: { params: Promise<{ lang: 'en' | 'es' }> }) {
    const { lang } = await props.params;
    return <AnalyticsDashboard lang={lang} />;
}
