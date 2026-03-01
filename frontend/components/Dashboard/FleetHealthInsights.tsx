'use client';

import { Card, CardBody, CardHeader, Chip, Progress } from "@heroui/react";
import useSWR from 'swr';
import { Activity, Zap, AlertCircle, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { safeFetcher } from '../../hooks/useSWRConfig';

interface SmartInsight {
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    affectedInstances: number;
    affectedWorkflows: number;
    metadata: any;
    timestamp: string;
}

export function FleetHealthInsights() {
    const { data, isLoading } = useSWR<SmartInsight[]>('/api/alerts/insights', safeFetcher, {
        refreshInterval: 30000
    });

    const insights = Array.isArray(data) ? data : [];

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'danger';
            case 'HIGH': return 'warning';
            case 'MEDIUM': return 'primary';
            default: return 'default';
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'NODE_FAILURE': return <Zap size={20} className="text-yellow-500" />;
            case 'API_OUTAGE': return <ShieldAlert size={20} className="text-red-500" />;
            default: return <Activity size={20} className="text-blue-500" />;
        }
    };

    return (
        <Card className="h-full bg-gradient-to-br from-content1 to-default-100/50 border-none shadow-xl">
            <CardHeader className="flex flex-col items-start px-6 pt-6 pb-2">
                <div className="flex items-center gap-2 mb-1">
                    <Activity size={20} className="text-primary" />
                    <h3 className="font-bold text-xl uppercase tracking-wider text-default-700">Fleet Intelligence</h3>
                </div>
                <p className="text-tiny text-default-400">AI-Correlated patterns across your automation fleet</p>
            </CardHeader>
            <CardBody className="px-4 pb-6">
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col gap-2">
                            <Progress size="sm" isIndeterminate aria-label="Loading insights..." color="primary" />
                            <p className="text-center text-tiny text-default-400">Analyzing error patterns...</p>
                        </div>
                    ) : insights.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center bg-success-50/10 rounded-xl border border-success-500/20">
                            <ShieldAlert size={40} className="text-success-500 mb-2 opacity-50" />
                            <p className="text-sm font-semibold text-success-600">Optimal Fleet Condition</p>
                            <p className="text-tiny text-success-500/70 px-4">No global failure patterns detected in the last 24 hours.</p>
                        </div>
                    ) : (
                        insights.map((insight) => (
                            <div key={insight.id} className="relative overflow-hidden group p-4 rounded-xl bg-content2/50 border border-default-200 hover:border-primary/50 transition-all duration-300">
                                <div className="flex items-start gap-3 relative z-10">
                                    <div className="p-2 rounded-lg bg-content1 shadow-sm">
                                        {getIcon(insight.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-bold text-sm text-default-800">{insight.title}</h4>
                                            <Chip size="sm" color={getSeverityColor(insight.severity) as any} variant="flat" className="font-bold text-[10px]">
                                                {insight.severity}
                                            </Chip>
                                        </div>
                                        <p className="text-xs text-default-500 mb-3 leading-relaxed">
                                            {insight.message}
                                        </p>
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-default-400 uppercase font-bold">Affected</span>
                                                <span className="text-sm font-mono text-primary">{insight.affectedWorkflows} Workflows</span>
                                            </div>
                                            <div className="h-8 w-[1px] bg-default-200" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-default-400 uppercase font-bold">Detected</span>
                                                <span className="text-tiny text-default-500">
                                                    {formatDistanceToNow(new Date(insight.timestamp), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
                            </div>
                        ))
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
