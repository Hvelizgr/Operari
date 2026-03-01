'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader, Divider, Button, Input, Chip, User, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Search, Plus, Filter, MoreVertical, GitBranch, PlayCircle, Clock, GitCompare } from "lucide-react";
import { WorkflowDiffViewer } from "@/components/Workflow/WorkflowDiffViewer";

export default function WorkflowsPage() {
    const [selectedWorkflow, setSelectedWorkflow] = useState<{id: string, name: string} | null>(null);
    const [isDiffOpen, setIsDiffOpen] = useState(false);

    const workflows = [
        { id: 1, name: "Onboarding Cliente", status: "active", lastRun: "2 min ago", type: "Webhook", executions: 1240 },
        { id: 2, name: "Sincronización HubSpot", status: "paused", lastRun: "4 days ago", type: "Cron", executions: 85 },
        { id: 3, name: "Reporte de Ventas", status: "active", lastRun: "1 hour ago", type: "Cron", executions: 342 },
        { id: 4, name: "Error Handler Slack", status: "error", lastRun: "10 sec ago", type: "Sub-workflow", executions: 5600 },
        { id: 5, name: "Limpieza de Logs", status: "active", lastRun: "12 hours ago", type: "Cron", executions: 12 }
    ];

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen text-white">
            <div className="flex justify-between items-center border-b border-[#27272a] pb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Workflows
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm">Manage, deploy, and monitor your automation pipelines.</p>
                </div>
                <Button color="primary" endContent={<Plus size={18} />} radius="full" className="font-semibold shadow-lg shadow-blue-900/20">
                    New Workflow
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-20 bg-[#09090b]/80 backdrop-blur-md py-4 border-b border-[#27272a] -mx-8 px-8 transition-all">
                <div className="w-full md:max-w-lg">
                     <Input
                        placeholder="Search workflows..."
                        startContent={<Search size={18} className="text-gray-500" />}
                        variant="bordered"
                        radius="lg"
                        size="lg"
                        classNames={{
                            inputWrapper: "bg-[#18181b]/50 border-[#27272a] hover:border-[#3f3f46] focus-within:!border-blue-500 transition-colors shadow-sm h-12 min-h-12",
                            input: "text-white placeholder:text-gray-500",
                            mainWrapper: "h-12"
                        }}
                    />
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                    <Button 
                        variant="bordered" 
                        startContent={<Filter size={16} />} 
                        radius="lg"
                        className="bg-[#18181b]/50 text-gray-300 border-[#27272a] hover:bg-[#27272a] hover:text-white transition-all text-sm h-10"
                    >
                        Status
                    </Button>
                    <Button 
                        variant="bordered" 
                        startContent={<GitBranch size={16} />} 
                        radius="lg"
                        className="bg-[#18181b]/50 text-gray-300 border-[#27272a] hover:bg-[#27272a] hover:text-white transition-all text-sm h-10"
                    >
                        Tags
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                {workflows.map((wf) => (
                    <Card key={wf.id} className="w-full bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] transition-all shadow-none hover:shadow-lg group">
                        <CardHeader className="flex justify-between items-start p-5 pb-0">
                            <div className="flex gap-4 items-center">
                                <div className={`p-3 rounded-xl border border-white/5 ${
                                        wf.type === 'Webhook' ? 'bg-purple-500/10 text-purple-400' :
                                        wf.type === 'Cron' ? 'bg-orange-500/10 text-orange-400' :
                                        'bg-blue-500/10 text-blue-400'
                                    }`}>
                                    {wf.type === 'Webhook' ? <Zap size={20} /> : wf.type === 'Cron' ? <Clock size={20} /> : <GitBranch size={20} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors">{wf.name}</h3>
                                    <p className="text-xs text-gray-500 font-mono mt-1">ID: {wf.id}</p>
                                </div>
                            </div>
                            <Dropdown>
                                <DropdownTrigger>
                                    <div className="p-2 rounded-lg hover:bg-[#27272a] cursor-pointer text-gray-500 hover:text-white transition-colors">
                                        <MoreVertical size={16} />
                                    </div>
                                </DropdownTrigger>
                                    <DropdownMenu aria-label="Workflow actions" className="dark text-white">
                                        <DropdownItem key="edit">Edit</DropdownItem>
                                        <DropdownItem 
                                            key="compare" 
                                            startContent={<GitCompare size={14}/>}
                                            onClick={() => {
                                                setSelectedWorkflow({id: wf.id.toString(), name: wf.name});
                                                setIsDiffOpen(true);
                                            }}
                                        >
                                            Compare Versions
                                        </DropdownItem>
                                        <DropdownItem key="duplicate">Duplicate</DropdownItem>
                                        <DropdownItem key="logs">View Logs</DropdownItem>
                                        <DropdownItem key="delete" className="text-danger" color="danger">Delete</DropdownItem>
                                    </DropdownMenu>

                            </Dropdown>
                        </CardHeader>
                        <CardBody className="px-5 py-5 space-y-4">
                             {/* Status Line */}
                             <div className="flex items-center justify-between">
                                <Chip
                                    size="sm"
                                    variant="flat"
                                    className={`border-none ${
                                        wf.status === 'active' ? 'bg-green-500/10 text-green-500' : 
                                        wf.status === 'error' ? 'bg-red-500/10 text-red-500' : 
                                        'bg-yellow-500/10 text-yellow-500'
                                    }`}
                                    startContent={<div className={`w-1.5 h-1.5 rounded-full ml-1 ${
                                        wf.status === 'active' ? 'bg-green-500' : 
                                        wf.status === 'error' ? 'bg-red-500' : 
                                        'bg-yellow-500'
                                    }`}></div>}
                                >
                                    {wf.status === 'active' ? 'Active' : wf.status === 'paused' ? 'Paused' : 'Error'}
                                </Chip>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock size={12}/> {wf.lastRun}
                                </span>
                             </div>

                             <Divider className="bg-[#27272a]" />

                             {/* Footer Stats */}
                             <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-lg font-bold text-white">{wf.executions.toLocaleString()}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-gray-500">Executions</span>
                                </div>
                                <Button 
                                    size="sm" 
                                    className="bg-[#27272a] text-white hover:bg-blue-600 hover:text-white transition-colors"
                                    startContent={<PlayCircle size={14} />}
                                >
                                    Run
                                </Button>
                             </div>
                        </CardBody>
                    </Card>
                ))}

                {/* Create New Card */}
                <Card isPressable className="w-full border border-dashed border-[#27272a] bg-[#09090b] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center min-h-[220px] group">
                    <CardBody className="items-center justify-center text-gray-500 group-hover:text-blue-400 transition-colors">
                        <div className="p-4 rounded-full bg-[#18181b] group-hover:bg-blue-500/10 mb-4 transition-all">
                            <Plus size={24} />
                        </div>
                        <p className="font-semibold text-sm">Create New Workflow</p>
                    </CardBody>
                </Card>
            </div>

            {selectedWorkflow && (
                <WorkflowDiffViewer 
                    isOpen={isDiffOpen} 
                    onClose={() => setIsDiffOpen(false)} 
                    workflowId={selectedWorkflow.id}
                    workflowName={selectedWorkflow.name}
                />
            )}
        </div>
    );
}

// Helper icon component
function Zap({ size }: { size: number }) { return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> }
