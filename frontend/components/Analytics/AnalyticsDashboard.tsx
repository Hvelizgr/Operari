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
    Chip
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
    Filter
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
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AnalyticsDashboard({ lang }: { lang: 'en' | 'es' }) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const result = await apiFetch(`/api/analytics/dashboard?days=${days}`);
                setData(result);
            } catch (error) {
                console.error('Failed to fetch analytics', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [days]);

    const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
        <Card className="border-none bg-slate-800/40 backdrop-blur-md">
            <CardBody className="p-4 flex flex-row items-center gap-4">
                <div className={`p-3 rounded-xl ${color} bg-opacity-20`}>
                    <Icon className={color.replace('bg-', 'text-')} size={24} />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-black text-white">{value}</h3>
                        {trend && (
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
        title: lang === 'en' ? 'Global Analytics' : 'Analíticas Globales',
        executionsOverTime: lang === 'en' ? 'Executions Over Time' : 'Ejecuciones en el Tiempo',
        topWorkflows: lang === 'en' ? 'Top Workflows' : 'Flujos Principales',
        recentActivity: lang === 'en' ? 'Recent Activity' : 'Actividad Reciente',
        successRate: lang === 'en' ? 'Success Rate' : 'Tasa de Éxito',
        summary: lang === 'en' ? 'Summary' : 'Resumen',
    };

    return (
        <div className="p-8 space-y-8 max-w-[1400px] mx-auto custom-scrollbar overflow-y-auto h-screen pb-32">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-blue-500" size={40} />
                        {t.title}
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Monitoring {data?.summary.totalWorkflows} automation workflows across your tenant.</p>
                </div>
                <ButtonGroup variant="flat" className="bg-slate-800/50 p-1 rounded-xl">
                    <Button 
                        size="sm" 
                        onPress={() => setDays(7)}
                        className={days === 7 ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}
                    >7d</Button>
                    <Button 
                        size="sm" 
                        onPress={() => setDays(30)}
                        className={days === 30 ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}
                    >30d</Button>
                    <Button 
                        size="sm" 
                        onPress={() => setDays(90)}
                        className={days === 90 ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}
                    >90d</Button>
                </ButtonGroup>
            </header>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Executions" 
                    value={data?.summary.totalExecutions.toLocaleString()} 
                    icon={Zap} 
                    color="bg-blue-500" 
                />
                <StatCard 
                    title="Success Rate" 
                    value={`${data?.summary.successRate}%`} 
                    icon={CheckCircle2} 
                    color="bg-green-500" 
                    trend={2.5}
                />
                <StatCard 
                    title="Failure Rate" 
                    value={`${100 - (data?.summary.successRate || 100)}%`} 
                    icon={AlertTriangle} 
                    color="bg-red-500" 
                    trend={-1.2}
                />
                <StatCard 
                    title="Active Flows" 
                    value={data?.summary.activeWorkflows} 
                    icon={Activity} 
                    color="bg-purple-500" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Graph */}
                <Card className="lg:col-span-2 border-none bg-slate-800/40 backdrop-blur-md">
                    <CardHeader className="flex flex-row items-center justify-between p-6">
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                            <Clock size={20} className="text-blue-400" />
                            {t.executionsOverTime}
                        </h3>
                    </CardHeader>
                    <CardBody className="h-80 w-full overflow-hidden p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.executionsByDay}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#64748b', fontSize: 10}} 
                                    minTickGap={30}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#64748b', fontSize: 10}} 
                                />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}}
                                    itemStyle={{color: '#3b82f6'}}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="count" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorCount)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardBody>
                </Card>

                {/* Pie Chart / Top Workflows */}
                <Card className="border-none bg-slate-800/40 backdrop-blur-md">
                    <CardHeader className="p-6">
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">{t.topWorkflows}</h3>
                    </CardHeader>
                    <CardBody className="h-80 p-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.topWorkflows}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="_count"
                                >
                                    {data?.topWorkflows.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-4">
                            {data?.topWorkflows.map((wf, idx) => (
                                <div key={wf.workflowId} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}} />
                                        <span className="text-slate-300 font-medium truncate max-w-[120px]">
                                            Workflow {wf.workflowId.substring(0, 8)}
                                        </span>
                                    </div>
                                    <span className="text-slate-500 font-bold">{wf._count} runs</span>
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Recent Executions Table */}
            <Card className="border-none bg-slate-800/40 backdrop-blur-md overflow-hidden">
                <CardHeader className="p-6 bg-white/5 border-b border-white/5 flex items-center justify-between">
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
                            {(data?.recentExecutions || []).map((exec) => (
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
        </div>
    );
}
