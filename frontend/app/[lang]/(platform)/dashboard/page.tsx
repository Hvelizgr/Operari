'use client';

import { Card, CardBody, CardHeader, Divider, Button, Progress, Tabs, Tab, Chip, User, Link, Select, SelectItem, Popover, PopoverTrigger, PopoverContent, Spacer } from "@heroui/react";
import { Activity, CheckCircle, XCircle, AlertTriangle, Play, Clock, Zap, BookOpen, Terminal, Shield, GraduationCap, Video, FileJson, Share2, Crown, User as UserIcon, Lock, Stethoscope, Microscope, Gavel, Server, ArrowRight, Sparkles } from "lucide-react";
import { useSubscription, PlanType } from "@/context/SubscriptionContext";
import { useState } from "react";
import { ActivityChart, AnimatedStat } from "@/components/Dashboard/Analytics";
import { MetricsDashboard, AIWorkflowGenerator, FleetHealthInsights, AlertsFeed } from "@/components/Dashboard"; // Updated

import useSWR from 'swr';
// ... (rest of imports)

// ... inside the component tabs ...



const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function DashboardPage() {
    const { plan, setPlan, role, setRole, features } = useSubscription();

    // Use SWR to fetch health status
    const { data: healthData, error: healthError } = useSWR(
        `${process.env.NEXT_PUBLIC_API_URL}/api/n8n/health`, 
        fetcher,
        { refreshInterval: 5000 }
    );

    const isHealthy = healthData?.status === 'healthy';
    const connectionStatus = isHealthy ? 'Online' : 'Offline';
    const connectionColor = isHealthy ? 'text-green-500' : 'text-red-500';

    // 1. FREE PLAN: Workflow Doctor Content
    const DoctorContent = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Row */}
                <AnimatedStat label="Health Score" value="98/100" icon={Stethoscope} color="green" />
                <AnimatedStat label="n8n Connection" value={connectionStatus} icon={Activity} color={connectionColor} />
                <AnimatedStat label="Issues Found" value="0" icon={Shield} color="green" />

                {/* Main Content */}
                <div className="md:col-span-2">
                    <ActivityChart />
                </div>
                
                <Card className="bg-[#18181b] border border-[#27272a]">
                    <CardHeader className="font-bold text-white px-6 pt-6">Last System Scan</CardHeader>
                    <CardBody className="px-6 pb-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm p-3 bg-[#27272a]/50 rounded-lg border border-[#27272a]">
                                <span className="flex items-center gap-3 text-gray-400"><CheckCircle size={16} className="text-green-500"/> Secrets Analysis</span>
                                <span className="text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded text-xs">SAFE</span>
                            </div>
                            <div className="flex items-center justify-between text-sm p-3 bg-[#27272a]/50 rounded-lg border border-[#27272a]">
                                <span className="flex items-center gap-3 text-gray-400"><CheckCircle size={16} className="text-green-500"/> Node Connections</span>
                                <span className="text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded text-xs">V. GOOD</span>
                            </div>
                            <div className="flex items-center justify-between text-sm p-3 bg-[#27272a]/50 rounded-lg border border-[#27272a]">
                                <span className="flex items-center gap-3 text-gray-400"><AlertTriangle size={16} className="text-yellow-500"/> Flow Complexity</span>
                                <span className="text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded text-xs">MEDIUM</span>
                            </div>
                            <Spacer y={2} />
                            <Button className="w-full bg-blue-600 text-white font-medium shadow-lg shadow-blue-900/20" variant="solid" startContent={<Microscope size={18} />}>Run Deep Scan</Button>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Smart Insights & Alerts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FleetHealthInsights />
                <AlertsFeed />
            </div>
        </div>
    );

    // 2. EDU PLAN: Classroom Content
    const ClassroomContent = () => (
        <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border border-blue-900/50 bg-blue-950/10">
                    <CardHeader className="px-6 pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                                <GraduationCap size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Pending Assignments</h3>
                                <p className="text-sm text-gray-400">Tasks assigned by your instructor</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardBody className="px-6 pb-6 pt-2">
                        <div className="space-y-3">
                            <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl flex justify-between items-center group hover:border-blue-500/50 transition-colors">
                                <div>
                                    <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">Build a Telegram Bot</h4>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Clock size={12} /> Due: Tomorrow, 10:00 AM</p>
                                </div>
                                <Button size="sm" color="primary" variant="flat" endContent={<ArrowRight size={14}/>}>Start</Button>
                            </div>
                            <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl flex justify-between items-center opacity-70">
                                <div>
                                    <h4 className="font-bold text-gray-400 line-through">HTTP Request Basics</h4>
                                    <p className="text-xs text-green-500 font-bold mt-1">Grade: 10/10</p>
                                </div>
                                <Chip size="sm" color="success" variant="flat">Completed</Chip>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card className="bg-[#18181b] border border-[#27272a]">
                    <CardHeader className="px-6 pt-6"><h3 className="font-bold text-white">Your Progress</h3></CardHeader>
                    <CardBody className="grid grid-cols-2 gap-4 px-6 pb-6">
                        <div className="text-center p-6 bg-[#27272a]/50 rounded-xl border border-[#27272a]">
                            <div className="text-3xl font-bold text-blue-500 mb-1">9.8</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Avg Grade</div>
                        </div>
                        <div className="text-center p-6 bg-[#27272a]/50 rounded-xl border border-[#27272a]">
                            <div className="text-3xl font-bold text-purple-500 mb-1">12</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Tasks Done</div>
                        </div>
                    </CardBody>
                </Card>
             </div>
        </div>
    );

    // 3. DEV PLAN: Governance Content
    const GovernanceContent = () => (
        <div className="space-y-6">
             {!features.canAccessAuditLogs ? (
                <div className="p-16 text-center border-2 border-dashed border-[#27272a] rounded-2xl bg-[#18181b]">
                    <div className="w-16 h-16 bg-[#27272a] rounded-full flex items-center justify-center mx-auto mb-6">
                        <Shield size={32} className="text-gray-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Governance Locked</h3>
                    <p className="text-gray-400 mb-8 max-w-md mx-auto">Upgrade to an Enterprise plan to enable Policy Firewall, Audit Logs, and Advanced Security Controls.</p>
                    <Button className="font-bold bg-white text-black" size="lg" onClick={() => setPlan('enterprise')}>Upgrade to Enterprise</Button>
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-red-950/10 border border-red-900/30">
                        <CardHeader className="flex gap-4 px-6 pt-6">
                            <div className="p-3 bg-red-900/20 rounded-xl border border-red-900/30">
                                <Gavel size={24} className="text-red-500" />
                            </div>
                            <div className="flex flex-col">
                                <p className="text-lg font-bold text-white">Policy Violations</p>
                                <p className="text-sm text-gray-400">Detected in last 24 hours</p>
                            </div>
                        </CardHeader>
                        <CardBody className="px-6 pb-6">
                            <div className="text-5xl font-bold text-red-500 mb-4 tracking-tighter">3</div>
                            <div className="p-3 bg-red-900/10 rounded-lg border border-red-900/20">
                                <p className="text-xs text-red-300 font-mono">Blocked: 'Execute Command' node usage detected in unprivileged workflow [ID: flow-773].</p>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="bg-[#18181b] border border-[#27272a]">
                         <CardHeader className="px-6 pt-6"><h3 className="font-bold text-white">Active Rules</h3></CardHeader>
                         <CardBody className="px-6 pb-6">
                            <div className="space-y-3">
                                <Chip color="success" variant="flat" className="w-full justify-start pl-2 h-auto py-2">
                                    <div className="flex flex-col items-start gap-1">
                                        <span className="font-bold text-xs">ALLOW LIST</span>
                                        <span className="text-[10px]">HTTP Requests (Internal IPs only)</span>
                                    </div>
                                </Chip>
                                <Chip color="danger" variant="flat" className="w-full justify-start pl-2 h-auto py-2">
                                    <div className="flex flex-col items-start gap-1">
                                        <span className="font-bold text-xs">BLOCK LIST</span>
                                        <span className="text-[10px]">Execute Command, Read File (Root)</span>
                                    </div>
                                </Chip>
                                <Chip color="warning" variant="flat" className="w-full justify-start pl-2 h-auto py-2">
                                    <div className="flex flex-col items-start gap-1">
                                        <span className="font-bold text-xs">AUDIT MODE</span>
                                        <span className="text-[10px]">Log all Webhook payloads &gt; 1MB</span>
                                    </div>
                                </Chip>
                            </div>
                         </CardBody>
                    </Card>
                </div>
             )}
        </div>
    );

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen text-white">
            {/* Header with Sim Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#27272a] pb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Command Center
                        </h1>
                        <Popover placement="bottom">
                            <PopoverTrigger>
                                <Chip 
                                    variant="flat" 
                                    classNames={{
                                        base: `cursor-pointer transition-opacity hover:opacity-80 border ${
                                            plan === 'enterprise' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 
                                            (plan === 'pro' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 
                                            'bg-[#27272a] border-[#3f3f46] text-gray-400')
                                        }`,
                                        content: "font-bold text-xs uppercase tracking-wider"
                                    }}
                                >
                                    {plan === 'student' ? 'FREE' : (plan === 'pro' ? 'STUDENT' : 'DEVOPS')} MODE
                                </Chip>
                            </PopoverTrigger>
                            <PopoverContent className="p-4 w-64 bg-[#18181b] border border-[#27272a]">
                                <div className="space-y-3">
                                    <h4 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Switch Context</h4>
                                    <Button size="sm" fullWidth className={plan === 'student' ? 'bg-white text-black' : 'bg-[#27272a] text-gray-400'} onClick={() => setPlan('student')}>Individual (Free)</Button>
                                    <Button size="sm" fullWidth className={plan === 'pro' ? 'bg-blue-600 text-white' : 'bg-[#27272a] text-gray-400'} onClick={() => setPlan('pro')}>Student (Edu)</Button>
                                    <Button size="sm" fullWidth className={plan === 'enterprise' ? 'bg-purple-600 text-white' : 'bg-[#27272a] text-gray-400'} onClick={() => setPlan('enterprise')}>DevOps (Enterprise)</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <p className="text-gray-400 text-sm max-w-xl">
                        {plan === 'student' && "Monitoring personal instance health and basic diagnostics."}
                        {plan === 'pro' && "Access to learning resources, assignments, and grades."}
                        {plan === 'enterprise' && "Company-wide governance, compliance monitoring, and security audit logs."}
                    </p>
                </div>
            </div>

            <Tabs 
                aria-label="Dashboard Views" 
                color="primary" 
                variant="underlined"
                classNames={{
                    tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                    cursor: "w-full bg-blue-500",
                    tab: "max-w-fit px-0 h-12",
                    tabContent: "group-data-[selected=true]:text-blue-500 text-gray-400 font-medium"
                }}
                selectedKey={plan === 'student' ? 'doctor' : (plan === 'pro' ? 'classroom' : 'governance')}
            >
                
                <Tab key="doctor" title={
                    <div className="flex items-center gap-2">
                        <Stethoscope size={18} />
                        <span>Workflow Doctor</span>
                    </div>
                }>
                    <div className="pt-4">
                        <DoctorContent />
                    </div>
                </Tab>

                <Tab key="classroom" title={
                    <div className="flex items-center gap-2">
                        <GraduationCap size={18} />
                        <span>Classroom</span>
                    </div>
                }>
                    <div className="pt-4">
                         <ClassroomContent />
                    </div>
                </Tab>

                <Tab key="governance" title={
                    <div className="flex items-center gap-2">
                        <Shield size={18} />
                        <span>Governance</span>
                        {!features.canAccessAuditLogs && <Lock size={12} className="text-gray-600" />}
                    </div>
                }>
                    <div className="pt-4">
                        <GovernanceContent />
                    </div>
                </Tab>

                <Tab key="metrics" title={
                    <div className="flex items-center gap-2">
                        <Server size={18} />
                        <span>System Monitor</span>
                    </div>
                }>
                     <div className="pt-4">
                        <MetricsDashboard />
                     </div>
                </Tab>

                <Tab key="ai-orchestrator" title={
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-primary" />
                        <span>AI Orchestrator</span>
                    </div>
                }>
                     <div className="pt-4 max-w-4xl mx-auto">
                        <AIWorkflowGenerator />
                     </div>
                </Tab>
            </Tabs>
        </div>
    );
}
