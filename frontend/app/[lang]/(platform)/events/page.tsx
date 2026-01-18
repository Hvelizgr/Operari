'use client';

import { Card, CardBody, CardHeader, Divider, Button, Chip, Pagination } from "@heroui/react";
import { AlertCircle, CheckCircle, Info, XCircle, Search } from "lucide-react";

export default function EventsPage() {
    const events = [
        { id: 1, type: "error", msg: "Connection refused at postgres:5432", time: "10:23:45 AM", source: "System" },
        { id: 2, type: "info", msg: "Workflow_84 started execution", time: "10:15:22 AM", source: "Worker-02" },
        { id: 3, type: "warning", msg: "Memory usage > 80%", time: "09:45:10 AM", source: "Monitor" },
        { id: 4, type: "success", msg: "Backup completed successfully", time: "09:00:00 AM", source: "Scheduler" },
        { id: 5, type: "error", msg: "Invalid API Key provided", time: "08:55:12 AM", source: "API Gateway" },
        { id: 6, type: "info", msg: "User login: admin@nanoflow.com", time: "08:30:00 AM", source: "Auth" },
    ];

    return (
        <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-rose-500">
                        Registro de Eventos
                    </h1>
                    <p className="text-default-500 mt-2">Auditoría completa de todas las operaciones del sistema.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="flat">Exportar CSV</Button>
                    <Button color="primary">Actualizar</Button>
                </div>
            </div>

            <Card className="border-none shadow-md">
                <CardBody className="p-0 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-default-50 border-b border-default-200 text-xs uppercase text-default-500 font-semibold tracking-wider">
                            <tr>
                                <th className="py-4 px-6">Estado</th>
                                <th className="py-4 px-6">Timestamp</th>
                                <th className="py-4 px-6">Fuente</th>
                                <th className="py-4 px-6 w-full">Mensaje</th>
                                <th className="py-4 px-6">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-default-100">
                            {events.map((e) => (
                                <tr key={e.id} className="hover:bg-default-50 transition-colors group cursor-pointer text-sm">
                                    <td className="py-3 px-6">
                                        {e.type === 'error' && <Chip startContent={<XCircle size={14} />} color="danger" variant="flat" size="sm">Error</Chip>}
                                        {e.type === 'warning' && <Chip startContent={<AlertCircle size={14} />} color="warning" variant="flat" size="sm">Warn</Chip>}
                                        {e.type === 'info' && <Chip startContent={<Info size={14} />} color="primary" variant="flat" size="sm">Info</Chip>}
                                        {e.type === 'success' && <Chip startContent={<CheckCircle size={14} />} color="success" variant="flat" size="sm">Ok</Chip>}
                                    </td>
                                    <td className="py-3 px-6 font-mono text-default-400">{e.time}</td>
                                    <td className="py-3 px-6 font-medium text-default-700">{e.source}</td>
                                    <td className="py-3 px-6 text-default-600 group-hover:text-default-900">{e.msg}</td>
                                    <td className="py-3 px-6">
                                        <Button size="sm" isIconOnly variant="light"><Search size={16} /></Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="p-4 flex justify-center border-t border-default-100">
                        <Pagination total={10} initialPage={1} color="danger" />
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
