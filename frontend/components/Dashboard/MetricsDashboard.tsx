'use client';

import { Card, CardBody, CardHeader, Select, SelectItem } from "@heroui/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useSWR from 'swr';
import { useState } from 'react';
import { Activity, HardDrive, Cpu, Server } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface MetricChartProps {
    title: string;
    metricName: string;
    color: string;
    icon: any;
    unit: string;
}

function MetricChart({ title, metricName, color, icon: Icon, unit }: MetricChartProps) {
    // Fetch last 50 data points
    const { data } = useSWR(`/api/metrics?metricName=${metricName}&limit=50`, fetcher, { refreshInterval: 5000 });

    // Transform data for Recharts
    // Backend returns [{ timestamp: '...', value: 123 }, ...] descending
    // We need ascending for chart
    const chartData = data ? [...data].reverse().map((d: any) => ({
        time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: d.value
    })) : [];

    const latestValue = data && data.length > 0 ? data[0].value.toFixed(1) : '--';

    return (
        <Card className="h-[300px] border-none bg-default-50/50">
            <CardHeader className="flex justify-between items-center px-6 py-4">
                <div className="flex gap-3 items-center">
                    <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-500`}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-default-700">{title}</h4>
                        <p className="text-tiny text-default-400">Real-time monitor</p>
                    </div>
                </div>
                <div className="text-2xl font-bold font-mono">
                    {latestValue}<span className="text-sm text-default-400 ml-1">{unit}</span>
                </div>
            </CardHeader>
            <CardBody className="pt-0 pb-4 px-2">
                <div className="h-full w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id={`grad${metricName}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color === 'blue' ? '#3b82f6' : (color === 'purple' ? '#a855f7' : '#22c55e')} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={color === 'blue' ? '#3b82f6' : (color === 'purple' ? '#a855f7' : '#22c55e')} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                            <XAxis dataKey="time" hide />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: any) => [`${Number(value).toFixed(1)}${unit}`, title]}
                                labelStyle={{ color: '#888' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke={color === 'blue' ? '#3b82f6' : (color === 'purple' ? '#a855f7' : '#22c55e')} 
                                strokeWidth={2} 
                                fillOpacity={1} 
                                fill={`url(#grad${metricName})`} 
                                animationDuration={500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-default-300 text-sm">
                        Waiting for data...
                    </div>
                )}
                </div>
            </CardBody>
        </Card>
    );
}

import { AlertsFeed } from "./AlertsFeed";

// ... previous imports ...

export function MetricsDashboard() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <Server className="text-default-500" /> Infrastructure Health
                </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricChart 
                    title="CPU Usage" 
                    metricName="cpu_usage_percent" 
                    color="blue" 
                    icon={Cpu} 
                    unit="%" 
                />
                <MetricChart 
                    title="Memory Usage" 
                    metricName="memory_usage_percent" 
                    color="purple" 
                    icon={Activity} 
                    unit="%" 
                />
                 <MetricChart 
                    title="Disk Usage" 
                    metricName="disk_usage_percent" 
                    color="green" 
                    icon={HardDrive} 
                    unit="%" 
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AlertsFeed />
                {/* Placeholder for future logs or map */}
                <Card className="bg-default-50/50 border-none h-[400px] flex items-center justify-center text-default-400">
                    <p>System Logs (Coming Soon)</p>
                </Card>
            </div>
        </div>
    );
}
