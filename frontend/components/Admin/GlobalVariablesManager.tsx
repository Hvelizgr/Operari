
'use client';

import { useState, useEffect } from 'react';
import { 
    Card, 
    CardHeader, 
    CardBody, 
    Button, 
    Input, 
    Table, 
    TableHeader, 
    TableColumn, 
    TableBody, 
    TableRow, 
    TableCell,
    Tooltip,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Chip
} from "@heroui/react";
import { Plus, Edit2, Trash2, RefreshCw, Key, Info, Zap } from "lucide-react";
import { toast } from "sonner";

interface GlobalVariable {
    id: string;
    key: string;
    value: string;
    description: string | null;
    updatedAt: string;
}

export function GlobalVariablesManager() {
    const [variables, setVariables] = useState<GlobalVariable[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
    
    const [formData, setFormData] = useState({
        id: '',
        key: '',
        value: '',
        description: ''
    });

    const fetchVariables = async () => {
        try {
            const response = await fetch('/api/global-variables');
            const data = await response.json();
            setVariables(data);
        } catch (error) {
            toast.error("Error fetching variables");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVariables();
    }, []);

    const handleSubmit = async () => {
        try {
            const method = formData.id ? 'PATCH' : 'POST';
            const url = formData.id ? `/api/global-variables/${formData.id}` : '/api/global-variables';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: formData.key,
                    value: formData.value,
                    description: formData.description
                })
            });

            if (response.ok) {
                toast.success(formData.id ? "Variable updated" : "Variable created");
                fetchVariables();
                onClose();
            } else {
                toast.error("Failed to save variable");
            }
        } catch (error) {
            toast.error("An error occurred");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will remove the variable from all instances on next sync.")) return;
        
        try {
            const response = await fetch(`/api/global-variables/${id}`, { method: 'DELETE' });
            if (response.ok) {
                toast.success("Variable deleted");
                fetchVariables();
            }
        } catch (error) {
            toast.error("Error deleting variable");
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const response = await fetch('/api/global-variables/sync', { method: 'POST' });
            if (response.ok) {
                toast.success("Synchronization triggered for all instances");
            } else {
                toast.error("Failed to trigger sync");
            }
        } catch (error) {
            toast.error("Sync error");
        } finally {
            setSyncing(false);
        }
    };

    const handlePropagate = async () => {
        setSyncing(true);
        try {
            const response = await fetch('/api/global-variables/propagate', { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                toast.success(`Reactive push complete: ${data.results.length} instances updated`);
            } else {
                toast.error("Propagation failed");
            }
        } catch (error) {
            toast.error("Propagation error");
        } finally {
            setSyncing(false);
        }
    };

    const openEdit = (v: GlobalVariable) => {
        setFormData({
            id: v.id,
            key: v.key,
            value: v.value,
            description: v.description || ''
        });
        onOpen();
    };

    const openCreate = () => {
        setFormData({ id: '', key: '', value: '', description: '' });
        onOpen();
    };

    return (
        <Card className="border-none bg-default-50 shadow-sm">
            <CardHeader className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold">Global Variables</h3>
                    <p className="text-sm text-default-500">Manage environment variables across your entire n8n fleet.</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        color="secondary" 
                        variant="flat" 
                        startContent={<Zap size={18} />}
                        onPress={handlePropagate}
                        isLoading={syncing}
                    >
                        Push to Fleet
                    </Button>
                    <Button 
                        color="primary" 
                        variant="flat" 
                        startContent={<RefreshCw size={18} className={syncing ? "animate-spin" : ""} />}
                        onPress={handleSync}
                        isLoading={syncing}
                    >
                        Sync (Legacy)
                    </Button>
                    <Button 
                        color="danger" 
                        startContent={<Plus size={18} />}
                        onPress={openCreate}
                    >
                        Add Variable
                    </Button>
                </div>
            </CardHeader>
            <CardBody>
                <Table aria-label="Global variables table" removeWrapper>
                    <TableHeader>
                        <TableColumn>KEY</TableColumn>
                        <TableColumn>VALUE</TableColumn>
                        <TableColumn>DESCRIPTION</TableColumn>
                        <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent={"No variables defined yet."} loadingContent={<RefreshCw className="animate-spin" />} loadingState={loading ? "loading" : "idle"}>
                        {variables.map((v) => (
                            <TableRow key={v.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Key size={14} className="text-primary" />
                                        <span className="font-mono font-bold text-danger">NANOFLOW_VAR_{v.key.toUpperCase()}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <code className="bg-default-200 px-2 py-1 rounded text-xs">
                                        {v.value.length > 20 ? v.value.substring(0, 20) + '...' : v.value}
                                    </code>
                                </TableCell>
                                <TableCell className="text-default-500 text-sm italic">{v.description || 'No description'}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Tooltip content="Edit">
                                            <Button isIconOnly size="sm" variant="light" onPress={() => openEdit(v)}>
                                                <Edit2 size={16} />
                                            </Button>
                                        </Tooltip>
                                        <Tooltip content="Delete" color="danger">
                                            <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => handleDelete(v.id)}>
                                                <Trash2 size={16} />
                                            </Button>
                                        </Tooltip>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3">
                    <Info className="text-primary flex-shrink-0" />
                    <p className="text-xs text-default-600">
                        Variables are prefixed with <span className="font-bold">NANOFLOW_VAR_</span> when pushed to instances. 
                        Changing these values will cause instances to <span className="text-danger font-bold">RESTART</span> to apply changes.
                    </p>
                </div>
            </CardBody>

            <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
                <ModalContent>
                    <ModalHeader>{formData.id ? 'Edit Variable' : 'Create Global Variable'}</ModalHeader>
                    <ModalBody className="space-y-4">
                        <Input 
                            label="Key" 
                            placeholder="e.g. OPENAI_API_KEY" 
                            variant="bordered"
                            value={formData.key}
                            onValueChange={(val) => setFormData({...formData, key: val})}
                            description="Will be converted to uppercase and prefixed."
                        />
                        <Input 
                            label="Value" 
                            placeholder="Your secret or value" 
                            variant="bordered"
                            value={formData.value}
                            onValueChange={(val) => setFormData({...formData, value: val})}
                        />
                        <Input 
                            label="Description" 
                            placeholder="What is this for?" 
                            variant="bordered"
                            value={formData.description}
                            onValueChange={(val) => setFormData({...formData, description: val})}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" onPress={onClose}>Cancel</Button>
                        <Button color="danger" onPress={handleSubmit}>Save Variable</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Card>
    );
}
