'use client';

import { Card, CardBody, CardHeader, Divider, Button, Input, Chip, User, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Search, Plus, Filter, MoreVertical, GitBranch, PlayCircle, Clock } from "lucide-react";

export default function WorkflowsPage() {
    const workflows = [
        { id: 1, name: "Onboarding Cliente", status: "active", lastRun: "2 min ago", type: "Webhook", executions: 1240 },
        { id: 2, name: "Sincronización HubSpot", status: "paused", lastRun: "4 days ago", type: "Cron", executions: 85 },
        { id: 3, name: "Reporte de Ventas", status: "active", lastRun: "1 hour ago", type: "Cron", executions: 342 },
        { id: 4, name: "Error Handler Slack", status: "error", lastRun: "10 sec ago", type: "Sub-workflow", executions: 5600 },
        { id: 5, name: "Limpieza de Logs", status: "active", lastRun: "12 hours ago", type: "Cron", executions: 12 }
    ];

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Flujos de Trabajo
                    </h1>
                    <p className="text-default-500 mt-2">Gestiona, despliega y monitorea tus automatizaciones.</p>
                </div>
                <Button color="primary" endContent={<Plus size={18} />} size="lg" className="shadow-lg shadow-blue-500/30 font-semibold">
                    Nuevo Flujo
                </Button>
            </div>

            <Card className="border-none shadow-sm sticky top-4 z-10 backdrop-blur-md bg-background/80">
                <CardBody className="flex flex-row gap-4 p-4">
                    <Input
                        placeholder="Buscar flujos por nombre, ID o tag..."
                        startContent={<Search size={18} className="text-default-400" />}
                        className="flex-1 max-w-lg"
                        variant="bordered"
                    />
                    <div className="flex gap-2">
                        <Button variant="flat" startContent={<Filter size={18} />}>
                            Estado
                        </Button>
                        <Button variant="flat" startContent={<GitBranch size={18} />}>
                            Etiquetas
                        </Button>
                    </div>
                </CardBody>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                {workflows.map((wf) => (
                    <Card key={wf.id} isHoverable className="w-full transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10 border border-white/5 bg-white/5 backdrop-blur-md cursor-pointer">
                        <CardHeader className="flex justify-between items-start p-4 pb-0">
                            <div className="flex gap-3 items-center">
                                <div className={`p-2.5 rounded-xl ${wf.type === 'Webhook' ? 'bg-purple-500/10 text-purple-400' :
                                        wf.type === 'Cron' ? 'bg-orange-500/10 text-orange-400' :
                                            'bg-blue-500/10 text-blue-400'
                                    } border border-white/5`}>
                                    {wf.type === 'Webhook' ? <Zap size={20} /> : wf.type === 'Cron' ? <Clock size={20} /> : <GitBranch size={20} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-tight text-white">{wf.name}</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">ID: {wf.id} • v1.2.0</p>
                                </div>
                            </div>
                            <Dropdown>
                                <DropdownTrigger>
                                    <div className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer text-gray-400 hover:text-white transition-colors">
                                        <MoreVertical size={18} />
                                    </div>
                                </DropdownTrigger>
                                <DropdownMenu aria-label="Acciones de flujo">
                                    <DropdownItem key="edit">Editar</DropdownItem>
                                    <DropdownItem key="duplicate">Duplicar</DropdownItem>
                                    <DropdownItem key="logs">Ver Logs</DropdownItem>
                                    <DropdownItem key="delete" className="text-danger" color="danger">Eliminar</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </CardHeader>
                        <CardBody className="px-4 py-4">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex flex-col">
                                    <span className="text-xs text-gray-500 uppercase font-semibold">Estado</span>
                                    <Chip
                                        size="sm"
                                        variant="flat"
                                        color={wf.status === 'active' ? 'success' : wf.status === 'error' ? 'danger' : 'warning'}
                                        className="mt-1 capitalize border border-white/5"
                                        startContent={<div className={`w-1.5 h-1.5 rounded-full mr-1 ${wf.status === 'active' ? 'bg-green-500' : wf.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                                            }`}></div>}
                                    >
                                        {wf.status === 'active' ? 'Activo' : wf.status === 'paused' ? 'Pausado' : 'Error'}
                                    </Chip>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-xs text-gray-500 uppercase font-semibold">Última ejecución</span>
                                    <span className="text-sm font-medium mt-1 text-gray-300">{wf.lastRun}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                <span className="text-xs text-gray-500">{wf.executions} ejecuciones totales</span>
                                <div 
                                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 cursor-pointer flex items-center gap-2 text-sm transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Ejecutar
                                    <PlayCircle size={14} />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                ))}

                {/* Create New Card */}
                <Card isPressable className="w-full border-2 border-dashed border-white/10 bg-white/5 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center min-h-[220px] group backdrop-blur-sm">
                    <CardBody className="items-center justify-center text-gray-500 group-hover:text-blue-400 transition-colors">
                        <div className="p-4 rounded-full bg-white/5 group-hover:bg-blue-500/20 mb-3 shadow-lg group-hover:shadow-blue-500/20 transition-all">
                            <Plus size={32} />
                        </div>
                        <p className="font-semibold text-lg">Crear nuevo flujo</p>
                        <p className="text-xs opacity-50 text-center max-w-[150px] mt-1">Desde plantilla o en blanco</p>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}

// Helper icon component
function Zap({ size }: { size: number }) { return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> }
