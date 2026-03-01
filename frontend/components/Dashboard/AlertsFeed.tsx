'use client';

import { Card, CardBody, CardHeader, Button, Chip } from "@heroui/react";
import useSWR from 'swr';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { safeFetcher } from '../../hooks/useSWRConfig';

export function AlertsFeed() {
    const { data, mutate } = useSWR('/api/alerts?limit=10&isRead=false', safeFetcher, { refreshInterval: 10000 });

    const alerts = data?.data || [];
    const totalUnread = data?.pagination?.total || 0;

    const handleMarkAllRead = async () => {
        await fetch('/api/alerts/mark-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alertIds: 'all' })
        });
        mutate();
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return <XCircle size={18} className="text-red-500" />;
            case 'HIGH': return <AlertTriangle size={18} className="text-orange-500" />;
            case 'MEDIUM': return <AlertTriangle size={18} className="text-yellow-500" />;
            default: return <Info size={18} className="text-blue-500" />;
        }
    };

    return (
        <Card className="h-[400px] bg-default-50/50 border-none">
            <CardHeader className="flex justify-between items-center px-6 py-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">Recent Alerts</h3>
                    {totalUnread > 0 && (
                        <Chip size="sm" color="danger" variant="flat">{totalUnread} new</Chip>
                    )}
                </div>
                {totalUnread > 0 && (
                    <Button size="sm" variant="light" color="primary" onClick={handleMarkAllRead}>
                        Mark all read
                    </Button>
                )}
            </CardHeader>
            <CardBody className="px-2">
                <div className="space-y-2 overflow-y-auto h-full pr-2">
                    {alerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-default-400">
                            <CheckCircle size={32} className="mb-2 opacity-50" />
                            <p>All systems normal</p>
                        </div>
                    ) : (
                        alerts.map((alert: any) => (
                            <div key={alert.id} className="p-3 rounded-lg bg-content1 hover:bg-content2 transition-colors border border-default-100 flex gap-3 items-start">
                                <div className="mt-1 flex-shrink-0">
                                    {getSeverityIcon(alert.severity)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-sm truncate pr-2">{alert.title}</h4>
                                        <span className="text-tiny text-default-400 whitespace-nowrap">
                                            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-default-500 line-clamp-2 mt-1">
                                        {alert.message}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
