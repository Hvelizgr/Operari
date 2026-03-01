
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Progress, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Tooltip } from "@heroui/react";
import { Plus, RefreshCw, Server, Trash2, Globe, Cpu, HardDrive, HeartPulse, ShieldAlert, Zap, History, ExternalLink, ShieldCheck } from 'lucide-react';
import axios from 'axios';

interface N8nInstance {
    id: string;
    name: string;
    url: string;
    status: string;
    cpuUsage: number;
    ramUsage: number;
    version: string;
}

interface Execution {
    id: string;
    workflowId: string;
    status: string;
    startedAt: string;
    instanceName: string;
    instanceId: string;
    mode: string;
}

export function InstancesDashboard() {
    const [instances, setInstances] = useState<N8nInstance[]>([]);
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingExecs, setLoadingExecs] = useState(false);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [newInstance, setNewInstance] = useState({ name: '', url: '', apiKey: '' });

    const fetchInstances = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/admin/instances');
            setInstances(response.data);
        } catch (error) {
            console.error('Error fetching instances', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchGlobalExecutions = async () => {
        setLoadingExecs(true);
        try {
            const response = await axios.get('/api/fleet/executions');
            setExecutions(response.data);
        } catch (error) {
            console.error('Error fetching global executions', error);
        } finally {
            setLoadingExecs(false);
        }
    };

    useEffect(() => {
        fetchInstances();
        fetchGlobalExecutions();
    }, []);

    const handleCreate = async () => {
        try {
            await axios.post('/api/admin/instances', newInstance);
            fetchInstances();
            onOpenChange();
        } catch (error) {
            console.error('Error creating instance', error);
        }
    };

    const handleRefresh = async (id: string) => {
        try {
            await axios.post(`/api/admin/instances/${id}/refresh`);
            fetchInstances();
        } catch (error) {
            console.error('Error refreshing instance', error);
        }
    };

    const handleAutoHeal = async (id: string) => {
        try {
            await axios.post(`/api/fleet/auto-heal/${id}`);
            fetchInstances();
        } catch (error) {
            console.error('Auto-heal failed', error);
        }
    };

    const handleFleetUpdate = async () => {
        if (!confirm('Update all instances to v1.75.0?')) return;
        try {
            await axios.post('/api/fleet/update-fleet', { version: '1.75.0' });
            fetchInstances();
        } catch (error) {
            console.error('Fleet update failed', error);
        }
    };

    const handleDebug = async (instanceId: string, executionId: string) => {
        try {
            const response = await axios.post(`/api/fleet/debug/${instanceId}/${executionId}`);
            alert(`AI Analysis: ${response.data.explanation}\n\nRoot Cause: ${response.data.rootCause}`);
        } catch (error) {
            console.error('Debug failed', error);
        }
    };

    const handleImpersonate = async (id: string) => {
        try {
            const response = await axios.get(`/api/n8n/impersonate/${id}`);
            window.open(response.data.url, '_blank');
        } catch (error) {
            console.error('Impersonation failed', error);
            alert('Failed to generate seamless login URL. Ensure you have ADMIN privileges.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this instance?')) return;
        try {
            await axios.delete(`/api/admin/instances/${id}`);
            fetchInstances();
        } catch (error) {
            console.error('Error deleting instance', error);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Server className="text-primary" />
                        Fleet Manager
                    </h3>
                    <p className="text-tiny text-default-400">Manage your n8n instances and global operations</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="flat" 
                        color="secondary" 
                        startContent={<Zap size={18} />}
                        onClick={handleFleetUpdate}
                    >
                        Fleet Update
                    </Button>
                    <Button color="primary" startContent={<Plus size={18} />} onPress={onOpen}>
                        Connect Instance
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {instances.map(instance => (
                    <Card key={instance.id} className="border-none shadow-sm overflow-hidden">
                        <div className={`h-1 w-full ${
                            instance.status === 'ONLINE' ? 'bg-success' : 
                            instance.status === 'UPGRADING' ? 'bg-warning' : 'bg-danger'
                        }`} />
                        <CardHeader className="flex justify-between pb-0">
                            <div className="flex gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Globe className="text-primary" size={20} />
                                </div>
                                <div>
                                    <p className="font-bold">{instance.name}</p>
                                    <p className="text-tiny text-default-400 truncate w-32">{instance.url}</p>
                                </div>
                            </div>
                            <Chip 
                                size="sm" 
                                color={
                                    instance.status === 'ONLINE' ? 'success' : 
                                    instance.status === 'UPGRADING' ? 'warning' : 'danger'
                                } 
                                variant="flat"
                            >
                                {instance.status}
                            </Chip>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-tiny">
                                    <span className="flex items-center gap-1"><Cpu size={12} /> CPU</span>
                                    <span>{instance.cpuUsage.toFixed(1)}%</span>
                                </div>
                                <Progress size="sm" value={instance.cpuUsage} color="primary" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-tiny">
                                    <span className="flex items-center gap-1"><HardDrive size={12} /> RAM</span>
                                    <span>{instance.ramUsage.toFixed(0)} MB</span>
                                </div>
                                <Progress size="sm" value={(instance.ramUsage / 2048) * 100} color="secondary" />
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-tiny text-default-400">v{instance.version || '1.24.0'}</span>
                                    <div className="flex gap-1">
                                        <Tooltip content="Seamless Login">
                                            <Button isIconOnly size="sm" variant="flat" color="primary" onClick={() => handleImpersonate(instance.id)}>
                                                <ShieldCheck size={16} />
                                            </Button>
                                        </Tooltip>
                                        {instance.status !== 'ONLINE' && (

                                        <Button isIconOnly size="sm" variant="flat" color="warning" onClick={() => handleAutoHeal(instance.id)}>
                                            <HeartPulse size={16} />
                                        </Button>
                                    )}
                                    <Button isIconOnly size="sm" variant="light" onClick={() => handleRefresh(instance.id)}>
                                        <RefreshCw size={16} />
                                    </Button>
                                    <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => handleDelete(instance.id)}>
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="flex justify-between">
                    <h4 className="text-lg font-bold flex items-center gap-2">
                        <History size={20} className="text-primary" />
                        Global Execution Feed
                    </h4>
                    <Button size="sm" variant="light" startContent={<RefreshCw size={14} />} onClick={fetchGlobalExecutions} isLoading={loadingExecs}>
                        Refresh
                    </Button>
                </CardHeader>
                <CardBody>
                    <Table aria-label="Global executions" removeWrapper className="min-h-[200px]">
                        <TableHeader>
                            <TableColumn>INSTANCE</TableColumn>
                            <TableColumn>WORKFLOW</TableColumn>
                            <TableColumn>STATUS</TableColumn>
                            <TableColumn>STARTED AT</TableColumn>
                            <TableColumn>ACTIONS</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent="No recent executions across the fleet">
                            {executions.map((exec) => (
                                <TableRow key={exec.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-success" />
                                            {exec.instanceName}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-tiny">{exec.workflowId}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            size="sm" 
                                            color={exec.status === 'success' ? 'success' : 'danger'} 
                                            variant="flat"
                                        >
                                            {exec.status}
                                        </Chip>
                                    </TableCell>
                                    <TableCell className="text-tiny text-default-400">
                                        {new Date(exec.startedAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        {exec.status === 'failed' && (
                                            <Button 
                                                size="sm" 
                                                variant="flat" 
                                                color="danger" 
                                                startContent={<ShieldAlert size={14} />}
                                                onClick={() => handleDebug(exec.instanceId, exec.id)}
                                            >
                                                AI Debug
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardBody>
            </Card>


            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Connect New n8n Instance</ModalHeader>
                            <ModalBody className="space-y-4">
                                <Input 
                                    label="Instance Name" 
                                    placeholder="Production Worker 1" 
                                    value={newInstance.name}
                                    onChange={(e) => setNewInstance({...newInstance, name: e.target.value})}
                                />
                                <Input 
                                    label="API URL" 
                                    placeholder="https://n8n.your-domain.com" 
                                    value={newInstance.url}
                                    onChange={(e) => setNewInstance({...newInstance, url: e.target.value})}
                                />
                                <Input 
                                    label="API Key (Optional)" 
                                    type="password"
                                    value={newInstance.apiKey}
                                    onChange={(e) => setNewInstance({...newInstance, apiKey: e.target.value})}
                                />
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="primary" onPress={handleCreate}>Connect</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
