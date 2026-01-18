'use client';

import { Card, CardBody, CardHeader, Divider, Button, Progress, Tabs, Tab, Chip, User, Link, Select, SelectItem, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Activity, CheckCircle, XCircle, AlertTriangle, Play, Clock, Zap, BookOpen, Terminal, Shield, GraduationCap, Video, FileJson, Share2, Crown, User as UserIcon, Lock, Stethoscope, Microscope, Gavel, Server } from "lucide-react";
import { useSubscription, PlanType } from "@/context/SubscriptionContext";
import { useState } from "react";
import { ActivityChart, AnimatedStat } from "@/components/Dashboard/Analytics";
import { MetricsDashboard } from "@/components/Dashboard/MetricsDashboard"; // Updated

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
    const connectionColor = isHealthy ? 'green' : 'red';

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
                
                <Card className="bg-default-50">
                    <CardHeader className="font-bold">Last Scan</CardHeader>
                    <CardBody>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm p-2 bg-white/5 rounded-lg">
                                <span className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500"/> Secrets</span>
                                <span className="text-green-500 font-bold">Safe</span>
                            </div>
                            <div className="flex items-center justify-between text-sm p-2 bg-white/5 rounded-lg">
                                <span className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500"/> Nodes</span>
                                <span className="text-green-500 font-bold">Connected</span>
                            </div>
                            <div className="flex items-center justify-between text-sm p-2 bg-white/5 rounded-lg">
                                <span className="flex items-center gap-2"><AlertTriangle size={14} className="text-yellow-500"/> Complexity</span>
                                <span className="text-yellow-500 font-bold">Medium</span>
                            </div>
                            <Button className="w-full mt-2" color="primary" variant="shadow" startContent={<Microscope />}>Run Deep Scan</Button>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );

    // 2. EDU PLAN: Classroom Content
    const ClassroomContent = () => (
        <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-l-4 border-blue-500">
                    <CardHeader>
                        <h3 className="text-xl font-bold flex items-center gap-2"><GraduationCap /> Pending Assignments</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-4">
                            <div className="p-4 bg-default-100 rounded-xl flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold">Build a Telegram Bot</h4>
                                    <p className="text-xs text-default-500">Due: Tomorrow, 10:00 AM</p>
                                </div>
                                <Button size="sm" color="primary">Start Task</Button>
                            </div>
                            <div className="p-4 bg-default-100 rounded-xl flex justify-between items-center opacity-60">
                                <div>
                                    <h4 className="font-bold line-through">HTTP Request Basics</h4>
                                    <p className="text-xs text-green-600 font-bold">Grade: 10/10</p>
                                </div>
                                <Button size="sm" variant="flat" disabled>Completed</Button>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader><h3 className="font-bold">My Stats</h3></CardHeader>
                    <CardBody className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-blue-500/10 rounded-xl">
                            <div className="text-2xl font-bold text-blue-500">9.8</div>
                            <div className="text-xs text-default-500 uppercase">Avg Grade</div>
                        </div>
                        <div className="text-center p-4 bg-purple-500/10 rounded-xl">
                            <div className="text-2xl font-bold text-purple-500">12</div>
                            <div className="text-xs text-default-500 uppercase">Tasks Done</div>
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
                <div className="p-12 text-center border border-dashed border-default-300 rounded-xl bg-default-50">
                    <Shield size={64} className="mx-auto text-default-300 mb-6" />
                    <h3 className="text-2xl font-bold mb-2">Governance Locked</h3>
                    <p className="text-default-500 mb-6">Upgrade to Enterprise (DevOps) to enable Policy Firewall and Audit Logs.</p>
                    <Button color="secondary" onClick={() => setPlan('enterprise')}>Upgrade</Button>
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-red-500/5 border-red-500/20">
                        <CardHeader className="flex gap-3">
                            <div className="p-2 bg-red-500/20 rounded-lg"><Gavel size={20} className="text-red-500" /></div>
                            <div className="flex flex-col">
                                <p className="text-md font-bold">Policy Violations</p>
                                <p className="text-small text-default-500">Last 24 hours</p>
                            </div>
                        </CardHeader>
                        <CardBody>
                            <div className="text-4xl font-bold text-red-500 mb-2">3</div>
                            <p className="text-xs text-default-400">Blocked attempts to use 'Execute Command' node.</p>
                        </CardBody>
                    </Card>

                    <Card>
                         <CardHeader><h3 className="font-bold">Active Rules</h3></CardHeader>
                         <CardBody>
                            <div className="space-y-2">
                                <Chip color="success" variant="flat" className="w-full justify-start pl-2">Allow: HTTP (Internal IPs)</Chip>
                                <Chip color="danger" variant="flat" className="w-full justify-start pl-2">Block: Execute Command</Chip>
                                <Chip color="warning" variant="flat" className="w-full justify-start pl-2">Audit: All Webhooks</Chip>
                            </div>
                         </CardBody>
                    </Card>
                </div>
             )}
        </div>
    );

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen">
            {/* Header with Sim Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            Command Center
                        </h1>
                        <Popover placement="bottom">
                            <PopoverTrigger>
                                <Chip variant="flat" color={plan === 'enterprise' ? "secondary" : (plan === 'pro' ? "primary" : "default")} className="cursor-pointer font-bold uppercase hover:opacity-80 transition-opacity">
                                    {plan === 'student' ? 'FREE' : (plan === 'pro' ? 'STUDENT' : 'DEVOPS')} MODE
                                </Chip>
                            </PopoverTrigger>
                            <PopoverContent className="p-4 w-64">
                                <div className="space-y-2">
                                    <h4 className="font-bold text-sm">Switch Persona</h4>
                                    <Button size="sm" fullWidth variant={plan === 'student' ? 'solid' : 'light'} onClick={() => setPlan('student')}>Free (Doctor)</Button>
                                    <Button size="sm" fullWidth variant={plan === 'pro' ? 'solid' : 'light'} onClick={() => setPlan('pro')}>Education (Student)</Button>
                                    <Button size="sm" fullWidth variant={plan === 'enterprise' ? 'solid' : 'light'} onClick={() => setPlan('enterprise')}>DevOps (Admin)</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <p className="text-default-500 text-lg">
                        {plan === 'student' && "Watching your instance health."}
                        {plan === 'pro' && "Classroom mode active."}
                        {plan === 'enterprise' && "Enforcing governance policies."}
                    </p>
                </div>
            </div>

            <Tabs aria-label="Dashboard Views" color="primary" variant="bordered" selectedKey={plan === 'student' ? 'doctor' : (plan === 'pro' ? 'classroom' : 'governance')}>
                
                <Tab key="doctor" title={
                    <div className="flex items-center gap-2">
                        <Stethoscope size={16} />
                        <span>Workflow Doctor</span>
                    </div>
                }>
                    <DoctorContent />
                </Tab>

                <Tab key="classroom" title={
                    <div className="flex items-center gap-2">
                        <GraduationCap size={16} />
                        <span>Classroom</span>
                    </div>
                }>
                     <ClassroomContent />
                </Tab>

                <Tab key="governance" title={
                    <div className="flex items-center gap-2">
                        <Shield size={16} />
                        <span>Governance</span>
                        {!features.canAccessAuditLogs && <Lock size={12} className="text-default-400" />}
                    </div>
                }>
                    <GovernanceContent />
                </Tab>

                <Tab key="metrics" title={
                    <div className="flex items-center gap-2">
                        <Server size={16} />
                        <span>System Monitor</span>
                    </div>
                }>
                     <MetricsDashboard />
                </Tab>
            </Tabs>
        </div>
    );
}
