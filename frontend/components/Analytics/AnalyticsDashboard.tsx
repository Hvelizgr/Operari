'use client';

import { useState, useEffect } from 'react';
import { 
    Card, 
    CardHeader, 
    CardBody, 
    Divider, 
    Button, 
    ButtonGroup,
    Skeleton,
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Chip,
    Tabs,
    Tab
} from "@heroui/react";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    LineChart, 
    Line,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { 
    TrendingUp, 
    Zap, 
    AlertTriangle, 
    CheckCircle2, 
    Clock, 
    Activity,
    ChevronUp,
    ChevronDown,
    ShieldCheck,
    History,
    BarChart3
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface AnalyticsData {
    summary: {
        totalWorkflows: number;
        activeWorkflows: number;
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        successRate: number;
    };
    recentExecutions: any[];
    executionsByDay: any[];
    topWorkflows: any[];
    nodeMetrics: any[];
    advanced: {
        slaSummary?: {
            COMPLIANT: number;
            BREACHED: number;
            total: number;
            complianceRate: number;
        };
        durationTrends?: any[];
        topWorkflows?: any[];
        recentBreaches?: any[];
    }
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

import { useAuthStore } from '../../context/AuthContext';

// ... (existing helper function inside component if any, or just updates to imports)

export default function AnalyticsDashboard({ lang }: { lang: 'en' | 'es' }) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const { token } = useAuthStore();

    const MOCK_DATA: AnalyticsData = {
        summary: {
            totalWorkflows: 12,
            activeWorkflows: 8,
            totalExecutions: 1450,
            successfulExecutions: 1380,
            failedExecutions: 70,
            successRate: 95.2
        },
        recentExecutions: [
            { id: 1, workflow: { name: "Lead Sync CRM" }, startedAt: new Date().toISOString(), status: "SUCCESS", duration: 450 },
            { id: 2, workflow: { name: "Email Campaign" }, startedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), status: "SUCCESS", duration: 1200 },
            { id: 3, workflow: { name: "Data Backup" }, startedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), status: "ERROR", duration: 3000 },
            { id: 4, workflow: { name: "Lead Sync CRM" }, startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), status: "SUCCESS", duration: 420 },
            { id: 5, workflow: { name: "Weekly Report" }, startedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), status: "SUCCESS", duration: 8900 }
        ],
        executionsByDay: [],
        topWorkflows: [],
        nodeMetrics: [],
        advanced: {
            slaSummary: {
                COMPLIANT: 1400,
                BREACHED: 50,
                total: 1450,
                complianceRate: 96.5
            },
            durationTrends: [
                { date: "Mon", avgDuration: 400 },
                { date: "Tue", avgDuration: 350 },
                { date: "Wed", avgDuration: 500 },
                { date: "Thu", avgDuration: 450 },
                { date: "Fri", avgDuration: 380 },
                { date: "Sat", avgDuration: 300 },
                { date: "Sun", avgDuration: 320 }
            ],
            topWorkflows: [
                { workflowId: "1", name: "Lead Sync CRM", count: 850 },
                { workflowId: "2", name: "Email Campaign", count: 400 },
                { workflowId: "3", name: "Data Backup", count: 120 },
                { workflowId: "4", name: "User Onboarding", count: 80 }
            ],
            recentBreaches: [
                { 
                    id: "b1", 
                    sla: { name: "Max Duration 2s", workflow: { name: "Data Backup" } }, 
                    breachType: "TIMEOUT", 
                    actualValue: 3000, 
                    thresholdValue: 2000, 
                    timestamp: new Date().toISOString() 
                }
            ]
        }
    };

    useEffect(() => {
        // if (!token) return; // Allow rendering without token for demo purposes

        const fetchData = async () => {
            setLoading(true);
            try {
                // Parallel fetch for better performance
                const results = await Promise.allSettled([
                    apiFetch(`/api/analytics/dashboard?days=${days}`),
                    apiFetch(`/api/analytics/advanced/sla-summary?days=${days}`),
                    apiFetch(`/api/analytics/advanced/duration-trends?days=${days}`),
                    apiFetch(`/api/analytics/advanced/top-workflows?days=${days}`),
                    apiFetch(`/api/analytics/advanced/recent-breaches`),
                ]);

                const baseResult = results[0].status === 'fulfilled' ? results[0].value : null;
                
                if (!baseResult) {
                    throw new Error("API failed");
                }

                const slaSummary = results[1].status === 'fulfilled' ? results[1].value : null;
                const durationTrends = results[2].status === 'fulfilled' ? results[2].value : [];
                const topWorkflows = results[3].status === 'fulfilled' ? results[3].value : [];
                const recentBreaches = results[4].status === 'fulfilled' ? results[4].value : [];

                setData({
                    ...baseResult,
                    advanced: {
                        slaSummary,
                        durationTrends,
                        topWorkflows,
                        recentBreaches
                    }
                });
            } catch (error) {
                console.warn('Failed to fetch analytics, using mock data', error);
                setData(MOCK_DATA);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [days, token]);

    const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
        <Card className="border-none bg-slate-800/40 backdrop-blur-md">
            <CardBody className="p-4 flex flex-row items-center gap-4">
                <div className={`p-3 rounded-xl ${color} bg-opacity-20`}>
                    <Icon className={color.replace('bg-', 'text-')} size={24} />
                </div>
                <div className="flex-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
                    <div className="flex items-baseline justify-between">
                        <h3 className="text-2xl font-black text-white">{value}</h3>
                        {trend !== undefined && (
                            <span className={`text-[10px] font-bold flex items-center ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {trend > 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {Math.abs(trend)}%
                            </span>
                        )}
                    </div>
                </div>
            </CardBody>
        </Card>
    );

    if (loading && !data) {
        return (
            <div className="p-8 space-y-8 h-screen overflow-hidden">
                <div className="flex justify-between items-center">
                    <Skeleton className="w-48 h-10 rounded-lg" />
                    <Skeleton className="w-40 h-10 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-80 rounded-2xl" />
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            </div>
        );
    }

    const t = {
        title: lang === 'en' ? 'Enterprise Analytics' : 'Analíticas Empresariales',
        executionsOverTime: lang === 'en' ? 'Executions Over Time' : 'Ejecuciones en el Tiempo',
        topWorkflows: lang === 'en' ? 'Top Performance Workflows' : 'Flujos de Mayor Rendimiento',
        recentActivity: lang === 'en' ? 'Recent Executions' : 'Actividad Reciente',
        successRate: lang === 'en' ? 'Success Rate' : 'Tasa de Éxito',
        summary: lang === 'en' ? 'Summary' : 'Resumen',
        slaCompliance: lang === 'en' ? 'SLA Compliance' : 'Cumplimiento de SLA',
        durationTrends: lang === 'en' ? 'Duration Trends (ms)' : 'Tendencia de Duración (ms)',
        recentBreaches: lang === 'en' ? 'Recent SLA Breaches' : 'Infracciones de SLA Recientes',
    };

    return (
        <div className="p-8 space-y-8 max-w-[1400px] mx-auto custom-scrollbar overflow-y-auto h-screen pb-32">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-blue-500" size={40} />
                        {t.title}
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Enterprise governance and performance monitoring for {data?.summary.totalWorkflows} workflows.</p>
                </div>
                <ButtonGroup variant="flat" className="bg-slate-800/50 p-1.5 rounded-xl">
                    <Button 
                        size="md" 
                        onPress={() => setDays(7)}
                        className={`px-5 min-w-[60px] font-semibold ${days === 7 ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >7d</Button>
                    <Button 
                        size="md" 
                        onPress={() => setDays(30)}
                        className={`px-5 min-w-[60px] font-semibold ${days === 30 ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >30d</Button>
                    <Button 
                        size="md" 
                        onPress={() => setDays(90)}
                        className={`px-5 min-w-[60px] font-semibold ${days === 90 ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >90d</Button>
                </ButtonGroup>
            </header>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Execution Volume" 
                    value={data?.summary.totalExecutions.toLocaleString()} 
                    icon={Zap} 
                    color="bg-blue-500" 
                />
                <StatCard 
                    title="SLA Compliance" 
                    value={`${data?.advanced.slaSummary?.complianceRate ?? 100}%`} 
                    icon={ShieldCheck} 
                    color="bg-green-500" 
                />
                <StatCard 
                    title="Success Rate" 
                    value={`${data?.summary.successRate}%`} 
                    icon={CheckCircle2} 
                    color="bg-indigo-500" 
                />
                <StatCard 
                    title="Failure Rate" 
                    value={`${100 - (data?.summary.successRate || 100)}%`} 
                    icon={AlertTriangle} 
                    color="bg-red-500" 
                />
            </div>

            <Tabs aria-label="Analytics Tabs" variant="underlined" classNames={{
                tabList: "gap-6 w-full relative rounded-none p-0 border-b border-white/10",
                cursor: "w-full bg-blue-500",
                tab: "max-w-fit px-0 h-12",
                tabContent: "group-data-[selected=true]:text-blue-500 font-bold"
            }}>
                <Tab key="performance" title={
                    <div className="flex items-center space-x-2">
                        <Activity size={18} />
                        <span>Performance</span>
                    </div>
                }>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                        <Card className="lg:col-span-2 border-none bg-slate-800/40 backdrop-blur-md">
                            <CardHeader className="p-6">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <Clock size={20} className="text-blue-400" />
                                    {t.durationTrends}
                                </h3>
                            </CardHeader>
                            <CardBody className="h-80 p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data?.advanced.durationTrends}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fill: '#64748b', fontSize: 10}} 
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fill: '#64748b', fontSize: 10}} 
                                        />
                                        <Tooltip 
                                            contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="avgDuration" 
                                            stroke="#3b82f6" 
                                            strokeWidth={3} 
                                            dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                                            activeDot={{ r: 8 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardBody>
                        </Card>

                        <Card className="border-none bg-slate-800/40 backdrop-blur-md">
                            <CardHeader className="p-6">
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">{t.topWorkflows}</h3>
                            </CardHeader>
                            <CardBody className="h-80 p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data?.advanced.topWorkflows}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="count"
                                        >
                                            {data?.advanced.topWorkflows?.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-2 mt-4">
                                    {data?.advanced.topWorkflows?.map((wf: any, idx: number) => (
                                        <div key={wf.workflowId} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}} />
                                                <span className="text-slate-300 font-medium truncate max-w-[120px]">
                                                    {wf.name}
                                                </span>
                                            </div>
                                            <span className="text-slate-500 font-bold">{wf.count} runs</span>
                                        </div>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key="compliance" title={
                    <div className="flex items-center space-x-2">
                        <ShieldCheck size={18} />
                        <span>Compliance & SLAs</span>
                    </div>
                }>
                    <div className="grid grid-cols-1 gap-6 mt-6">
                        <Card className="border-none bg-slate-800/40 backdrop-blur-md overflow-hidden">
                            <CardHeader className="p-6 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-red-400" />
                                    {t.recentBreaches}
                                </h3>
                            </CardHeader>
                            <CardBody className="p-0">
                                <Table 
                                    aria-label="Recent SLA breaches"
                                    classNames={{
                                        base: "bg-transparent",
                                        table: "bg-transparent",
                                        thead: "bg-slate-800/50",
                                        tr: "border-b border-white/5 hover:bg-white/5 transition-colors",
                                        td: "py-4 text-sm text-slate-300"
                                    }}
                                >
                                    <TableHeader>
                                        <TableColumn>WORKFLOW</TableColumn>
                                        <TableColumn>SLA NAME</TableColumn>
                                        <TableColumn>BREACH TYPE</TableColumn>
                                        <TableColumn>ACTUAL</TableColumn>
                                        <TableColumn>THRESHOLD</TableColumn>
                                        <TableColumn>TIMESTAMP</TableColumn>
                                    </TableHeader>
                                    <TableBody emptyContent="No SLA breaches detected in the selected period.">
                                        {(data?.advanced.recentBreaches || []).map((breach: any) => (
                                            <TableRow key={breach.id}>
                                                <TableCell className="font-bold text-white">{breach.sla.workflow.name}</TableCell>
                                                <TableCell>{breach.sla.name}</TableCell>
                                                <TableCell>
                                                    <Chip size="sm" color="danger" variant="dot" className="font-bold uppercase text-[10px]">
                                                        {breach.breachType}
                                                    </Chip>
                                                </TableCell>
                                                <TableCell className="text-red-400 font-mono">{breach.actualValue}</TableCell>
                                                <TableCell className="text-slate-500 font-mono">{breach.thresholdValue}</TableCell>
                                                <TableCell>{new Date(breach.timestamp).toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key="history" title={
                    <div className="flex items-center space-x-2">
                        <History size={18} />
                        <span>Execution Log</span>
                    </div>
                }>
                    <Card className="border-none bg-slate-800/40 backdrop-blur-md overflow-hidden mt-6">
                        <CardHeader className="p-6 bg-white/5 border-b border-white/5">
                            <h3 className="text-lg font-black text-white">{t.recentActivity}</h3>
                        </CardHeader>
                        <CardBody className="p-0">
                            <Table 
                                aria-label="Recent executions"
                                classNames={{
                                    base: "bg-transparent",
                                    table: "bg-transparent",
                                    thead: "bg-slate-800/50",
                                    tr: "border-b border-white/5 hover:bg-white/5 transition-colors",
                                    td: "py-3 text-sm text-slate-300"
                                }}
                            >
                                <TableHeader>
                                    <TableColumn>WORKFLOW</TableColumn>
                                    <TableColumn>STARTED</TableColumn>
                                    <TableColumn>STATUS</TableColumn>
                                    <TableColumn>DURATION</TableColumn>
                                </TableHeader>
                                <TableBody>
                                    {(data?.recentExecutions || []).map((exec: any) => (
                                        <TableRow key={exec.id}>
                                            <TableCell className="font-bold text-white">{exec.workflow.name}</TableCell>
                                            <TableCell>{new Date(exec.startedAt).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Chip 
                                                    size="sm" 
                                                    variant="flat" 
                                                    color={exec.status === 'SUCCESS' ? 'success' : 'danger'}
                                                    className="font-bold uppercase text-[10px]"
                                                >
                                                    {exec.status}
                                                </Chip>
                                            </TableCell>
                                            <TableCell className="font-mono text-slate-500">{exec.duration || '0'}ms</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardBody>
                    </Card>
                </Tab>
            </Tabs>
        </div>
    );
}
