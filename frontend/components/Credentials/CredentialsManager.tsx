'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { 
    Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
    Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
    Chip, useDisclosure, Textarea, Select, SelectItem
} from "@heroui/react";
import { Plus, Trash2, Edit2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
};

export function CredentialsManager() {
    const { data: credentials = [], error, mutate, isLoading } = useSWR('/api/credentials', fetcher);
    const { isOpen,onOpen, onOpenChange } = useDisclosure();
    const [viewMode, setViewMode] = useState(false); // For viewing secrets (future feature)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        type: 'API_KEY',
        data: '{}',
        description: '',
        environment: 'ALL' as 'ALL' | 'DEV' | 'STAGING' | 'PROD'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (onClose: () => void) => {
        setIsSubmitting(true);
        try {
            let parsedData;
            try {
                parsedData = JSON.parse(formData.data);
            } catch (e) {
                toast.error('Invalid JSON in data field');
                setIsSubmitting(false);
                return;
            }

            const res = await fetch('/api/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    type: formData.type,
                    data: parsedData,
                    description: formData.description,
                    scope: { environment: formData.environment }
                })
            });

            if (!res.ok) throw new Error('Failed to create credential');
            
            toast.success('Credential created successfully');
            mutate();
            onClose();
            // Reset form
            setFormData({ name: '', type: 'API_KEY', data: '{}', description: '', environment: 'ALL' });
        } catch (err) {
            toast.error('Error creating credential');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this credential?')) return;
        
        try {
            await fetch(`/api/credentials/${id}`, { method: 'DELETE' });
            toast.success('Credential deleted');
            mutate();
        } catch (err) {
            toast.error('Failed to delete credential');
        }
    };

    return (
        <div className="p-4 h-full flex flex-col gap-4">
            <div className="flex justify-between items-center bg-content1 p-4 rounded-xl border border-default-100 shadow-sm">
                <div>
                    <h2 className="text-lg font-semibold">Stored Credentials</h2>
                    <p className="text-small text-default-500">Manage secure keys, tokens, and certificates for your workflows.</p>
                </div>
                <Button color="primary" radius="full" endContent={<Plus className="w-4 h-4" />} onPress={onOpen}>
                    New Credential
                </Button>
            </div>

            <div className="flex-1 overflow-auto bg-content1 rounded-xl border border-default-100 shadow-sm p-2">
            <Table aria-label="Credentials table" removeWrapper>
                <TableHeader>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>TYPE</TableColumn>
                    <TableColumn>ENVIRONMENT</TableColumn>
                    <TableColumn>CREATED</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody 
                    emptyContent={isLoading ? "Loading..." : "No credentials found. Create one to get started."}
                    items={credentials || []}
                >
                    {(item: any) => (
                        <TableRow key={item.id}>
                            <TableCell>
                                <div>
                                    <p className="font-bold">{item.name}</p>
                                    <p className="text-tiny text-default-400">{item.description}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Chip size="sm" variant="flat" color="secondary">{item.type}</Chip>
                            </TableCell>
                            <TableCell>
                                <Chip size="sm" variant="dot" color={
                                    item.environment === 'PROD' ? 'danger' : 
                                    item.environment === 'STAGING' ? 'warning' : 
                                    item.environment === 'DEV' ? 'success' : 'default'
                                }>
                                    {item.environment}
                                </Chip>
                            </TableCell>
                            <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                    <Button isIconOnly size="sm" variant="light" onPress={() => handleDelete(item.id)}>
                                        <Trash2 className="w-4 h-4 text-danger" />
                                    </Button>
                                    {/* Edit Logic Later */}
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            </div>

            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Add New Credential</ModalHeader>
                            <ModalBody>
                                <div className="flex flex-col gap-4">
                                    <div className="flex gap-4">
                                        <Input 
                                            label="Name" 
                                            placeholder="e.g. OpenAI Key" 
                                            value={formData.name}
                                            onValueChange={(v) => setFormData({...formData, name: v})}
                                            isRequired
                                        />
                                        <Select 
                                            label="Environment" 
                                            defaultSelectedKeys={['ALL']}
                                            selectedKeys={[formData.environment]}
                                            onChange={(e) => setFormData({...formData, environment: e.target.value as any})}
                                        >
                                            <SelectItem key="ALL">All Environments</SelectItem>
                                            <SelectItem key="DEV">Development</SelectItem>
                                            <SelectItem key="STAGING">Staging</SelectItem>
                                            <SelectItem key="PROD">Production</SelectItem>
                                        </Select>
                                    </div>
                                    <div className="flex gap-4">
                                        <Select 
                                            label="Type" 
                                            defaultSelectedKeys={['API_KEY']}
                                            selectedKeys={[formData.type]}
                                            onChange={(e) => setFormData({...formData, type: e.target.value})}
                                        >
                                            <SelectItem key="API_KEY">API Key</SelectItem>
                                            <SelectItem key="OAUTH2">OAuth 2.0</SelectItem>
                                            <SelectItem key="DATABASE">Database Connection</SelectItem>
                                            <SelectItem key="CUSTOM">Custom JSON</SelectItem>
                                        </Select>
                                    </div>
                                    <Input 
                                        label="Description" 
                                        placeholder="Optional description"
                                        value={formData.description}
                                        onValueChange={(v) => setFormData({...formData, description: v})}
                                    />
                                    <Textarea
                                        label="Credential Data (JSON)"
                                        placeholder='{"apiKey": "sk-..."}'
                                        minRows={5}
                                        value={formData.data}
                                        onValueChange={(v) => setFormData({...formData, data: v})}
                                        description="Enter the secret values as a valid JSON object. This will be encrypted."
                                        classNames={{ input: "font-mono" }}
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button color="primary" isLoading={isSubmitting} onPress={() => handleSubmit(onClose)}>
                                    Save Credential
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
