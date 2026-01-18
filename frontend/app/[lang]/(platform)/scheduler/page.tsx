'use client';

import { Card, CardBody, CardHeader, Divider, Button, Input, Select, SelectItem } from "@heroui/react";
import { Plus, Search, Calendar, RefreshCcw } from "lucide-react";

export default function SchedulerPage() {
    const jobs = [
        { id: 1, name: "Database Backup", schedule: "0 0 * * *", nextRun: "12 hours", status: "Active" },
        { id: 2, name: "Email Digest", schedule: "0 9 * * 1", nextRun: "2 days", status: "Active" },
        { id: 3, name: "Cleanup Temp Files", schedule: "0 */4 * * *", nextRun: "30 mins", status: "Paused" },
    ];

    return (
        <div className="p-8 space-y-8 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-green-500">
                        Scheduler
                    </h1>
                    <p className="text-default-500 mt-2">Gestión de tareas programadas (Cron Jobs).</p>
                </div>
                <Button color="success" className="text-white" startContent={<Plus size={18} />}>Nueva Tarea</Button>
            </div>

            <Card className="border-none shadow-sm">
                <CardBody className="flex flex-row gap-4 p-4">
                    <Input
                        placeholder="Buscar tarea..."
                        startContent={<Search size={18} className="text-default-400" />}
                        className="flex-1"
                        variant="bordered"
                    />
                    <Select placeholder="Estado" className="max-w-xs" variant="bordered">
                        <SelectItem key="active">Activos</SelectItem>
                        <SelectItem key="paused">Pausados</SelectItem>
                    </Select>
                </CardBody>
            </Card>

            <div className="grid grid-cols-1 gap-4">
                {jobs.map((job) => (
                    <Card key={job.id} isPressable className="hover:bg-default-50 transition-colors group">
                        <CardBody className="flex flex-row items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-default-100 rounded-lg text-default-500 group-hover:text-teal-500 group-hover:bg-teal-500/20 transition-colors">
                                    <RefreshCcw size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{job.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-default-400 font-mono mt-1">
                                        <span className="bg-default-200 px-1.5 py-0.5 rounded text-xs text-default-600">{job.schedule}</span>
                                        <span>Next: {job.nextRun}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${job.status === 'Active' ? 'bg-green-500/10 text-green-500' : 'bg-default-200 text-default-500'}`}>
                                    {job.status}
                                </div>
                                <div className="p-2 rounded-lg text-default-400 hover:bg-default-100 transition-colors">
                                    <Calendar size={18} />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
}
