'use client';

import { Card, CardBody, CardHeader, Button, Input, Chip, DateRangePicker, Pagination, Accordion, AccordionItem } from "@heroui/react";
import { Download, Search, Filter, ShieldAlert, FileText, Play, Key, Settings, Trash2, Clock } from "lucide-react";

export default function AuditPage() {
    // Mock Audit Data
    const logs = [
        { id: 'evt_1', action: 'workflow.created', actor: 'Carlos Admin', resource: 'Onboarding Flow', ip: '192.168.1.1', time: 'Just now', type: 'create' },
        { id: 'evt_2', action: 'workflow.executed', actor: 'System', resource: 'Sync HubSpot (ID: 4)', ip: 'Internal', time: '2 mins ago', type: 'system' },
        { id: 'evt_3', action: 'credential.deleted', actor: 'Sarah Dev', resource: 'Stripe API Key', ip: '203.0.113.45', time: '1 hour ago', type: 'delete' },
        { id: 'evt_4', action: 'settings.updated', actor: 'Carlos Admin', resource: 'Security Policy', ip: '192.168.1.1', time: '4 hours ago', type: 'update' },
        { id: 'evt_5', action: 'user.invited', actor: 'Carlos Admin', resource: 'john@partner.com', ip: '192.168.1.1', time: 'Yesterday', type: 'create' },
        { id: 'evt_6', action: 'workflow.failed', actor: 'System', resource: 'Daily Report', ip: 'Internal', time: 'Yesterday', type: 'error' },
        { id: 'evt_7', action: 'api.key.rotated', actor: 'Sarah Dev', resource: 'Main API Key', ip: '203.0.113.45', time: '2 days ago', type: 'update' },
    ];

    const getIcon = (type: string) => {
        switch(type) {
            case 'create': return <FileText size={16} />;
            case 'delete': return <Trash2 size={16} />;
            case 'update': return <Settings size={16} />;
            case 'system': return <Play size={16} />;
            case 'error': return <ShieldAlert size={16} />;
            default: return <Clock size={16} />;
        }
    };

    const getColor = (type: string) => {
        switch(type) {
            case 'create': return 'success';
            case 'delete': return 'danger';
            case 'update': return 'primary';
            case 'system': return 'default';
            case 'error': return 'warning';
            default: return 'default';
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 text-white min-h-screen">
             <div className="flex justify-between items-end border-b border-[#27272a] pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                    <p className="text-gray-400 mt-2">Track every action and event within your organization.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="flat" className="bg-[#18181b] text-gray-300 border border-[#27272a]" startContent={<Filter size={16} />}>
                        Filters
                    </Button>
                    <Button color="primary" variant="ghost" startContent={<Download size={16} />}>
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Filter Bar */}
            <Card className="bg-[#18181b] border border-[#27272a] sticky top-0 z-10">
                <CardBody className="flex flex-col md:flex-row gap-4 p-4">
                     <Input 
                        placeholder="Search by user, resource or IP..." 
                        startContent={<Search size={16} className="text-gray-500"/>} 
                        variant="bordered"
                        className="flex-1"
                        classNames={{
                            inputWrapper: "bg-[#09090b] border-[#27272a] hover:border-[#3f3f46]",
                            input: "text-white"
                        }}
                    />
                    {/* Mock Date Picker (Visual) */}
                    <div className="w-full md:w-64 border border-[#27272a] rounded-lg bg-[#09090b] px-3 py-2 text-sm text-gray-400 flex justify-between items-center cursor-pointer hover:border-[#3f3f46]">
                        <span>Last 7 Days</span>
                        <Clock size={16} />
                    </div>
                </CardBody>
            </Card>

            {/* Logs List */}
            <div className="space-y-4">
                {/* Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-4">Event</div>
                    <div className="col-span-3">User</div>
                    <div className="col-span-3">Resource</div>
                    <div className="col-span-2 text-right">Time</div>
                </div>

                {logs.map((log) => (
                    <Card key={log.id} isPressable className="bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] transition-colors shadow-none">
                        <CardBody className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                {/* Event */}
                                <div className="col-span-4 flex items-center gap-3">
                                    <Chip 
                                        size="sm" 
                                        variant="flat" 
                                        color={getColor(log.type) as any}
                                        className="min-w-[32px] w-8 h-8 p-0 flex items-center justify-center border-none"
                                    >
                                        {getIcon(log.type)}
                                    </Chip>
                                    <div className="flex flex-col items-start overflow-hidden">
                                        <span className="font-mono text-sm font-bold text-gray-200 truncate w-full">{log.action}</span>
                                        <span className="text-[10px] text-gray-500 font-mono">IP: {log.ip}</span>
                                    </div>
                                </div>

                                {/* User */}
                                <div className="col-span-3 md:col-span-3 flex items-center gap-2">
                                     <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-[10px] font-bold">
                                        {log.actor[0]}
                                     </div>
                                     <span className="text-sm text-gray-300">{log.actor}</span>
                                </div>

                                {/* Resource */}
                                <div className="col-span-3 md:col-span-3">
                                     <code className="text-xs bg-[#09090b] px-2 py-1 rounded border border-[#27272a] text-gray-400">
                                         {log.resource}
                                     </code>
                                </div>

                                {/* Time */}
                                <div className="col-span-2 md:col-span-2 text-right text-xs text-gray-500 font-mono">
                                    {log.time}
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>

            <div className="flex justify-center pt-4">
                <Pagination total={10} initialPage={1} color="primary" variant="flat" />
            </div>
        </div>
    );
}
