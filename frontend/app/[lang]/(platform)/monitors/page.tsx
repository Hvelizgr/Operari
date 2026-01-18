'use client';

import { Card, CardBody, CardHeader, Divider, Button, Accordion, AccordionItem } from "@heroui/react";
import { Server, Database, Activity, Wifi, HardDrive, Cpu, AlertCircle } from "lucide-react";
import { AnimatedStat } from "@/components/Dashboard/Analytics";

export default function MonitorsPage() {
    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">
                        Monitores de Infraestructura
                    </h1>
                    <p className="text-default-500 mt-2">Estado en tiempo real de nodos de procesamiento y servicios.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-sm font-bold text-green-500">Todos los sistemas operativos</span>
                </div>
            </div>

            {/* Top Health Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <AnimatedStat icon={Server} label="Worker Nodes" value="3/3" color="green" />
                <AnimatedStat icon={Database} label="Redis Queue" value="12ms" color="green" />
                <AnimatedStat icon={HardDrive} label="Disk Usage" value="45%" color="yellow" />
                <AnimatedStat icon={Wifi} label="Webhook Gateway" value="99.9%" color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-4">
                        <CardHeader>
                            <h3 className="font-bold text-xl flex items-center gap-2">
                                <Activity className="text-blue-500" />
                                Cola de TRabajos (Bull Queue)
                            </h3>
                        </CardHeader>
                        <Divider />
                        <CardBody>
                            {/* Simulated Queue Visualization */}
                            <div className="flex gap-1 h-12 w-full mt-4">
                                {Array.from({ length: 40 }).map((_, i) => (
                                    <div key={i} className={`flex-1 rounded-sm ${Math.random() > 0.8 ? 'bg-default-200' : 'bg-blue-500'} opacity-${Math.random() * 100}`} style={{ opacity: Math.random() }}></div>
                                ))}
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-default-400">
                                <span>Waiting: 124</span>
                                <span>Active: 12</span>
                                <span>Failed: 0</span>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="p-4">
                        <CardHeader>
                            <h3 className="font-bold text-xl flex items-center gap-2">
                                <Cpu className="text-purple-500" />
                                Rendimiento de Nodos
                            </h3>
                        </CardHeader>
                        <Divider />
                        <CardBody className="space-y-4">
                            <NodeStatus name="Worker-01 (Primary)" cpu={45} mem={60} />
                            <NodeStatus name="Worker-02 (Scale)" cpu={12} mem={30} />
                            <NodeStatus name="Worker-03 (Scale)" cpu={5} mem={24} />
                        </CardBody>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-default-50 border border-default-200">
                        <CardHeader>
                            <h3 className="font-bold text-lg flex items-center gap-2 text-default-700">
                                <AlertCircle size={20} />
                                Alertas Recientes
                            </h3>
                        </CardHeader>
                        <CardBody className="p-0">
                            <Accordion>
                                <AccordionItem key="1" aria-label="High CPU" title={<span className="text-sm font-semibold text-warning">Warning: High CPU Usage</span>} subtitle="Worker-01 at 09:41 AM">
                                    El uso de CPU superó el 80% durante 5 minutos.
                                </AccordionItem>
                                <AccordionItem key="2" aria-label="Redis Latency" title={<span className="text-sm font-semibold text-primary">Info: Redis Connection Peak</span>} subtitle="Cluster at 08:30 AM">
                                    Pico de conexiones simultáneas (1500).
                                </AccordionItem>
                            </Accordion>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}



function NodeStatus({ name, cpu, mem }: any) {
    return (
        <div className="flex items-center gap-4 p-3 bg-default-100 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <div className="flex-1">
                <p className="font-bold text-sm">{name}</p>
                <div className="flex gap-4 mt-1 text-xs text-default-500">
                    <span>CPU: {cpu}%</span>
                    <span>MEM: {mem}%</span>
                </div>
            </div>
            <div className="w-24 h-1.5 bg-default-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${cpu}%` }}></div>
            </div>
        </div>
    )
}
