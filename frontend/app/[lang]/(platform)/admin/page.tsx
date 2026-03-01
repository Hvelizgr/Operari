'use client';

import { Card, CardBody, CardHeader, Divider, Button, Tabs, Tab, Avatar, Input, Switch, Chip, Progress } from "@heroui/react";
import { User, Shield, List, Settings, Plus as PlusIcon, CheckCircle, XCircle, Clock, Server, Activity, Database, Cpu, Zap, Key, Layers } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useApprovals } from "@/hooks/useApprovals";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect } from 'react';
import { InstancesDashboard } from "@/components/Admin/InstancesDashboard";
import { ProcessMiningDashboard } from "@/components/Admin/ProcessMiningDashboard";
import { UsersManager } from "@/components/Admin/UsersManager";
import { GlobalVariablesManager } from "@/components/Admin/GlobalVariablesManager";
import { EnvironmentManager } from "@/components/Admin/EnvironmentManager";

export default function AdminPage() {
    const { tenant, users, auditLogs, loading: tenantLoading } = useTenant();
    const { pendingApprovals, reviewApproval, loading: approvalsLoading } = useApprovals();
    
    if (tenantLoading || approvalsLoading) return <div className="p-8 text-center"><div className="animate-pulse text-primary font-bold">Cargando NanoFlow Enterprise...</div></div>;

    const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await reviewApproval(id, status);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-danger">
                        NanoFlow Admin: {tenant?.name}
                    </h1>
                    <p className="text-default-500 mt-2">Governance, Scaling and Process Intelligence.</p>
                </div>
                <Chip variant="flat" color="danger" className="border-danger/20">Enterprise Plan</Chip>
            </div>

            <Tabs aria-label="admin options" color="danger" variant="underlined" classNames={{
                tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                cursor: "w-full bg-danger",
                tab: "max-w-fit px-0 h-12",
                tabContent: "group-data-[selected=true]:text-danger font-bold"
            }}>

                {/* USERS TAB */}
                <Tab key="users" title={
                    <div className="flex items-center gap-2">
                        <User size={18} />
                        <span>Workforce</span>
                    </div>
                }>
                    <div className="mt-6">
                        <UsersManager />
                    </div>
                </Tab>

                {/* INSTANCES TAB */}
                <Tab key="instances" title={
                    <div className="flex items-center gap-2">
                        <Server size={18} />
                        <span>Infrastructure</span>
                    </div>
                }>
                    <div className="mt-6">
                        <InstancesDashboard />
                    </div>
                </Tab>

                {/* ENVIRONMENTS TAB (SDLC - Gap B) */}
                <Tab key="environments" title={
                    <div className="flex items-center gap-2">
                        <Layers size={18} />
                        <span>SDLC Environments</span>
                    </div>
                }>
                    <div className="mt-6">
                        <EnvironmentManager />
                    </div>
                </Tab>

                {/* GLOBAL VARIABLES TAB */}
                <Tab key="variables" title={
                    <div className="flex items-center gap-2">
                        <Key size={18} />
                        <span>Variables</span>
                    </div>
                }>
                    <div className="mt-6">
                        <GlobalVariablesManager />
                    </div>
                </Tab>

                {/* PROCESS MINING TAB */}
                <Tab key="mining" title={
                    <div className="flex items-center gap-2">
                        <Zap size={18} />
                        <span>Process Mining</span>
                    </div>
                }>
                    <div className="mt-6">
                        <ProcessMiningDashboard />
                    </div>
                </Tab>

                {/* APPROVALS TAB */}
                <Tab key="approvals" title={
                    <div className="flex items-center gap-2">
                        <CheckCircle size={18} />
                        <span>Governance</span>
                        {pendingApprovals && pendingApprovals.length > 0 && (
                            <Chip size="sm" color="danger" variant="solid" className="min-w-[20px] h-5 px-1 text-[10px]">
                                {pendingApprovals.length}
                            </Chip>
                        )}
                    </div>
                }>
                    <Card className="mt-6 border-none bg-default-50 shadow-sm">
                        <CardHeader>
                            <div>
                                <h3 className="text-xl font-bold">Workflow Approvals</h3>
                                <p className="text-sm text-default-500">Review critical changes before deployment.</p>
                            </div>
                        </CardHeader>
                        <Divider />
                        <CardBody className="space-y-4">
                            {pendingApprovals?.length === 0 ? (
                                <div className="text-center py-12 text-default-400">
                                    <Clock size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>Everything is compliant. No pending requests.</p>
                                </div>
                            ) : (
                                pendingApprovals?.map((app: any) => (
                                    <div key={app.id} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-default-100 shadow-sm border border-default-200">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-lg">{app.workflow.name}</span>
                                                <Chip size="sm" color="warning" variant="flat">{app.requestType}</Chip>
                                            </div>
                                            <p className="text-sm text-default-500">By <span className="text-default-700 font-medium">{app.requester.name || app.requester.email}</span></p>
                                            {app.comment && (
                                                <p className="text-xs bg-default-200/50 p-2 rounded-lg mt-2 italic">
                                                    "{app.comment}"
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" color="danger" variant="flat" onPress={() => handleReview(app.id, 'REJECTED')}>Reject</Button>
                                            <Button size="sm" color="success" onPress={() => handleReview(app.id, 'APPROVED')}>Approve</Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardBody>
                    </Card>
                </Tab>

                {/* SECURITY TAB */}
                <Tab key="security" title={
                    <div className="flex items-center gap-2">
                        <Shield size={18} />
                        <span>Security</span>
                    </div>
                }>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-4 border-none bg-default-50 shadow-sm">
                            <CardHeader><h3 className="font-bold text-lg">Policies</h3></CardHeader>
                            <CardBody className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">Force 2FA</p>
                                        <p className="text-xs text-default-500">Require MFA for all workspace members.</p>
                                    </div>
                                    <Switch color="danger" size="sm" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">IP Whitelist</p>
                                        <p className="text-xs text-default-500">Restrict access to specific CIDR ranges.</p>
                                    </div>
                                    <Switch color="danger" size="sm" />
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="p-4 border-none bg-default-50 shadow-sm">
                            <CardHeader><h3 className="font-bold text-lg">Global API Keys</h3></CardHeader>
                            <CardBody className="space-y-4">
                                <div className="p-3 bg-white dark:bg-default-100 rounded-xl border border-default-200">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-bold">Main Service Account</span>
                                        <Chip size="sm" color="success" variant="flat">Active</Chip>
                                    </div>
                                    <code className="text-xs block font-mono truncate text-green-600">sk_nf_....................</code>
                                </div>
                                <Button variant="bordered" className="w-full border-dashed" startContent={<PlusIcon />}>Generate New Key</Button>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                {/* LOGS TAB */}
                <Tab key="logs" title={
                    <div className="flex items-center gap-2">
                        <List size={18} />
                        <span>Audit Logs</span>
                    </div>
                }>
                    <Card className="mt-6 border-none bg-default-50 shadow-sm">
                        <CardBody>
                            <div className="space-y-2">
                                {auditLogs?.map((log: any) => (
                                    <div key={log.id} className="text-xs p-3 rounded-lg bg-white dark:bg-default-100 flex justify-between items-center border border-default-200">
                                        <div>
                                            <span className="font-bold text-primary mr-2">{log.action}</span>
                                            <span className="text-default-600">by {log.user?.name || log.user?.email}</span>
                                            <span className="mx-2 opacity-20">|</span>
                                            <span className="italic text-default-400">{log.resourceType}: {log.resourceId}</span>
                                        </div>
                                        <div className="text-default-400">
                                            {format(new Date(log.createdAt), "HH:mm:ss d MMM", { locale: es })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </Tab>
            </Tabs>
        </div>
    );
}
