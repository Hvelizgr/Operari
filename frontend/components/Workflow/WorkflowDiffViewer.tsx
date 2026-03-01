'use client';

import React, { useState, useEffect } from 'react';
import { 
    Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
    Button, Select, SelectItem, Spinner, Card, CardBody, 
    Chip, Divider, Accordion, AccordionItem 
} from "@heroui/react";
import { GitCompare, Plus, Minus, Edit3, ArrowRight, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

interface DiffResult {
    nodes: {
        added: string[];
        removed: string[];
        modified: string[];
    };
    parameterChanges: Record<string, {
        property: string;
        oldValue: any;
        newValue: any;
    }[]>;
}

interface WorkflowDiffViewerProps {
    isOpen: boolean;
    onClose: () => void;
    workflowId: string;
    workflowName: string;
}

export function WorkflowDiffViewer({ isOpen, onClose, workflowId, workflowName }: WorkflowDiffViewerProps) {
    const [v1, setV1] = useState<string>('');
    const [v2, setV2] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [diff, setDiff] = useState<DiffResult | null>(null);
    const [versions, setVersions] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && workflowId) {
            fetchVersions();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, workflowId]);

    const fetchVersions = async () => {
        try {
            const response = await axios.get(`/api/versions/workflow/${workflowId}`);
            setVersions(response.data);
            if (response.data.length >= 2) {
                setV1(response.data[1].version.toString());
                setV2(response.data[0].version.toString());
            }
        } catch (error) {
            console.error('Failed to fetch versions', error);
        }
    };

    const handleCompare = async () => {
        if (!v1 || !v2) return;
        setLoading(true);
        try {
            const response = await axios.get(`/api/workflows/${workflowId}/diff?v1=${v1}&v2=${v2}`);
            setDiff(response.data);
        } catch (error) {
            console.error('Compare failed', error);
        } finally {
            setLoading(false);
        }
    };

    const renderValue = (val: any) => {
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onClose} size="4xl" scrollBehavior="inside" className="dark text-white">
            <ModalContent className="bg-[#09090b] border border-[#27272a]">
                <ModalHeader className="flex flex-col gap-1 border-b border-[#27272a]">
                    <div className="flex items-center gap-2">
                        <GitCompare className="text-primary" size={20} />
                        <span>Visual Diff: {workflowName}</span>
                    </div>
                    <p className="text-tiny text-default-400 font-normal">Compare infrastructure states and logic changes</p>
                </ModalHeader>
                <ModalBody className="py-6">
                    <div className="flex items-end gap-4 mb-8 p-4 bg-[#18181b] rounded-xl border border-[#27272a]">
                        <Select 
                            label="Base Version" 
                            size="sm" 
                            className="max-w-xs"
                            selectedKeys={[v1]}
                            onSelectionChange={(keys) => setV1(Array.from(keys)[0] as string)}
                        >
                            {versions.map(v => (
                                <SelectItem key={v.version} textValue={`v${v.version}`}>
                                    v{v.version} - {new Date(v.createdAt).toLocaleDateString()}
                                </SelectItem>
                            ))}
                        </Select>
                        <div className="pb-2"><ArrowRight size={20} className="text-default-400" /></div>
                        <Select 
                            label="Compare With" 
                            size="sm" 
                            className="max-w-xs"
                            selectedKeys={[v2]}
                            onSelectionChange={(keys) => setV2(Array.from(keys)[0] as string)}
                        >
                            {versions.map(v => (
                                <SelectItem key={v.version} textValue={`v${v.version}`}>
                                    v{v.version} - {new Date(v.createdAt).toLocaleDateString()}
                                </SelectItem>
                            ))}
                        </Select>
                        <Button color="primary" onPress={handleCompare} isLoading={loading} className="font-bold">
                            Run Comparison
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Spinner size="lg" />
                            <p className="text-default-400 animate-pulse">Analyzing structural differences...</p>
                        </div>
                    ) : diff ? (
                        <div className="space-y-6">
                            {/* Summary Chips */}
                            <div className="flex gap-3">
                                <Chip startContent={<Plus size={14}/>} color="success" variant="flat">{diff.nodes.added.length} Added</Chip>
                                <Chip startContent={<Minus size={14}/>} color="danger" variant="flat">{diff.nodes.removed.length} Removed</Chip>
                                <Chip startContent={<Edit3 size={14}/>} color="warning" variant="flat">{diff.nodes.modified.length} Modified</Chip>
                            </div>

                            <Divider className="bg-[#27272a]" />

                            <div className="space-y-2">
                                {diff.nodes.added.length > 0 && (
                                    <Accordion variant="splitted" selectionMode="multiple" className="px-0">
                                        <AccordionItem key="added" title="New Nodes" subtitle="Added in target version" startContent={<Plus className="text-success" size={18}/>}>
                                            <div className="grid grid-cols-2 gap-2">
                                                {diff.nodes.added.map(node => (
                                                    <div key={node} className="p-2 bg-success-500/10 border border-success-500/20 rounded-lg text-sm font-mono flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-success-500" /> {node}
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionItem>
                                    </Accordion>
                                )}

                                {diff.nodes.removed.length > 0 && (
                                    <Accordion variant="splitted" selectionMode="multiple" className="px-0">
                                        <AccordionItem key="removed" title="Deleted Nodes" subtitle="Removed from target version" startContent={<Minus className="text-danger" size={18}/>}>
                                            <div className="grid grid-cols-2 gap-2">
                                                {diff.nodes.removed.map(node => (
                                                    <div key={node} className="p-2 bg-danger-500/10 border border-danger-500/20 rounded-lg text-sm font-mono flex items-center gap-2 line-through opacity-50">
                                                        <div className="w-2 h-2 rounded-full bg-danger-500" /> {node}
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionItem>
                                    </Accordion>
                                )}

                                {diff.nodes.modified.map(nodeId => (
                                    <Accordion key={`mod-accordion-${nodeId}`} variant="splitted" selectionMode="multiple" className="px-0">
                                        <AccordionItem 
                                            key={`mod-${nodeId}`} 
                                            title={`Modified: ${nodeId}`} 
                                            subtitle={`${diff.parameterChanges[nodeId]?.length || 0} parameter changes`}
                                            startContent={<Edit3 className="text-warning" size={18}/>}
                                        >
                                            <div className="space-y-2">
                                                {diff.parameterChanges[nodeId].map((change, idx) => (
                                                    <div key={idx} className="text-xs bg-[#18181b] p-3 rounded-lg border border-[#27272a]">
                                                        <p className="text-primary font-bold mb-2 uppercase tracking-tighter">{change.property}</p>
                                                        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4">
                                                            <div className="p-2 bg-danger-500/10 rounded border border-danger-500/20 text-danger-300 truncate">
                                                                {renderValue(change.oldValue)}
                                                            </div>
                                                            <ArrowRight size={14} className="text-default-400" />
                                                            <div className="p-2 bg-success-500/10 rounded border border-success-500/20 text-success-300 truncate">
                                                                {renderValue(change.newValue)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionItem>
                                    </Accordion>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-default-500">
                            <GitCompare size={48} className="mb-4 opacity-20" />
                            <p>Select two versions to view structural differences</p>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter className="border-t border-[#27272a]">
                    <Button variant="light" onPress={onClose}>Close</Button>
                    <Button color="primary" variant="flat" onPress={() => window.print()} startContent={<CheckCircle2 size={16}/>}>Export Report</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
