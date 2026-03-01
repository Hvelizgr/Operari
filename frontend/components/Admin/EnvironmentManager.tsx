'use client';

import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Select, SelectItem, Divider, Progress, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Tooltip, Input } from "@heroui/react";
import { Layers, ArrowRight, Server, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import axios from 'axios';
import { toast } from 'sonner';

export function EnvironmentManager() {
    const [instances, setInstances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [promotionData, setPromotionData] = useState({
        workflowId: '',
        sourceInstanceId: '',
        targetInstanceId: ''
    });
    const [isPromoting, setIsPromotion] = useState(false);

    useEffect(() => {
        fetchInstances();
    }, []);

    const fetchInstances = async () => {
        try {
            const response = await axios.get('/api/fleet/instances');
            setInstances(response.data);
        } catch (error) {
            toast.error('Failed to load instances');
        } finally {
            setLoading(false);
        }
    };

    const updateEnvironment = async (instanceId: string, environment: string) => {
        try {
            await axios.post('/api/environment/set-environment', { instanceId, environment });
            toast.success(`Instance moved to ${environment}`);
            fetchInstances();
        } catch (error) {
            toast.error('Failed to update environment');
        }
    };

    const handlePromote = async () => {
        setIsPromotion(true);
        try {
            await axios.post('/api/environment/promote', promotionData);
            toast.success('Workflow promoted successfully');
            onOpenChange();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Promotion failed');
        } finally {
            setIsPromotion(false);
        }
    };

    const environments = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {environments.map((env) => (
                    <Card key={env} className="bg-default-50 border-none shadow-sm">
                        <CardHeader className="flex justify-between items-center px-4 pt-4">
                            <div className="flex items-center gap-2">
                                <Layers size={20} className={env === 'PRODUCTION' ? 'text-danger' : env === 'STAGING' ? 'text-warning' : 'text-primary'} />
                                <h3 className="font-bold text-lg">{env}</h3>
                            </div>
                            <Chip size="sm" variant="flat" color={env === 'PRODUCTION' ? 'danger' : env === 'STAGING' ? 'warning' : 'primary'}>
                                {instances.filter(i => i.environment === env).length} Instances
                            </Chip>
                        </CardHeader>
                        <Divider />
                        <CardBody className="p-4 space-y-3">
                            {instances.filter(i => i.environment === env).map((instance) => (
                                <div key={instance.id} className="p-3 bg-white dark:bg-default-100 rounded-xl border border-default-200 shadow-sm flex justify-between items-center group">
                                    <div>
                                        <p className="font-bold text-sm">{instance.name}</p>
                                        <p className="text-[10px] text-default-400 font-mono">{instance.url}</p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Tooltip content="Promote Workflow">
                                            <Button isIconOnly size="sm" variant="light" onPress={() => {
                                                setPromotionData({ ...promotionData, sourceInstanceId: instance.id });
                                                onOpen();
                                            }}>
                                                <ArrowRight size={14} />
                                            </Button>
                                        </Tooltip>
                                        <Select 
                                            size="sm" 
                                            className="w-24" 
                                            aria-label="Move environment"
                                            selectedKeys={[env]}
                                            onSelectionChange={(keys) => updateEnvironment(instance.id, Array.from(keys)[0] as string)}
                                        >
                                            {environments.map(e => <SelectItem key={e}>{e}</SelectItem>)}
                                        </Select>
                                    </div>
                                </div>
                            ))}
                            {instances.filter(i => i.environment === env).length === 0 && (
                                <p className="text-center py-8 text-default-400 text-sm italic">No instances assigned</p>
                            )}
                        </CardBody>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1 text-2xl font-black">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-danger">Promote Workflow</span>
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500 mb-4">
                                    This will clone the workflow to the target environment and attempt to rewrite credentials for the new context.
                                </p>
                                <Input 
                                    label="Workflow ID" 
                                    placeholder="Enter n8n workflow ID (e.g. 1)" 
                                    value={promotionData.workflowId}
                                    onChange={(e) => setPromotionData({ ...promotionData, workflowId: e.target.value })}
                                />
                                <Select 
                                    label="Target Instance" 
                                    placeholder="Select destination"
                                    onSelectionChange={(keys) => setPromotionData({ ...promotionData, targetInstanceId: Array.from(keys)[0] as string })}
                                >
                                    {instances
                                        .filter(i => i.id !== promotionData.sourceInstanceId)
                                        .map(i => <SelectItem key={i.id}>{i.name} ({i.environment})</SelectItem>)
                                    }
                                </Select>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button 
                                    color="danger" 
                                    onPress={handlePromote} 
                                    isLoading={isPromoting}
                                    startContent={!isPromoting && <RefreshCw size={18} />}
                                >
                                    Execute Promotion
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
