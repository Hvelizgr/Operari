'use client';

import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Input, Textarea, Select, SelectItem, Progress, Chip, Divider, Accordion, AccordionItem } from "@heroui/react";
import { Sparkles, Send, Box, ExternalLink, Bot, CheckCircle2, Terminal } from "lucide-react";
import axios from 'axios';
import { toast } from 'sonner';

export function AIWorkflowGenerator() {
    const [prompt, setPrompt] = useState('');
    const [instances, setInstances] = useState<any[]>([]);
    const [selectedInstance, setSelectedInstance] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        fetchInstances();
    }, []);

    const fetchInstances = async () => {
        try {
            const response = await axios.get('/api/fleet/instances');
            setInstances(response.data);
            if (response.data.length > 0) setSelectedInstance(response.data[0].id);
        } catch (error) {
            console.error('Failed to fetch instances');
        }
    };

    const handleGenerate = async () => {
        if (!prompt || !selectedInstance) {
            toast.error('Please enter a description and select an instance');
            return;
        }

        setIsGenerating(true);
        setResult(null);
        try {
            const response = await axios.post('/api/ai/generate-deploy', {
                prompt,
                instanceId: selectedInstance
            });
            setResult(response.data);
            toast.success('Workflow generated and deployed!');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-md">
            <CardHeader className="flex gap-3 px-6 pt-6">
                <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
                    <Sparkles className="text-white" size={24} />
                </div>
                <div className="flex flex-col">
                    <p className="text-xl font-black">AI Flow Orchestrator</p>
                    <p className="text-xs text-default-500 font-medium">Phase 3: Automated Workflow Generation</p>
                </div>
            </CardHeader>
            <CardBody className="px-6 pb-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold ml-1">Describe your automation</label>
                    <Textarea
                        variant="bordered"
                        placeholder="Ex: Send a Slack message when a new rows is added to Google Sheets, then save the data to PostgreSQL..."
                        minRows={3}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        classNames={{
                            input: "text-base",
                            inputWrapper: "border-default-200 focus-within:border-primary transition-colors"
                        }}
                    />
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full space-y-2">
                        <label className="text-sm font-bold ml-1">Target Instance</label>
                        <Select
                            placeholder="Select target n8n"
                            variant="bordered"
                            selectedKeys={selectedInstance ? [selectedInstance] : []}
                            onSelectionChange={(keys) => setSelectedInstance(Array.from(keys)[0] as string)}
                        >
                            {instances.map((inst) => (
                                <SelectItem key={inst.id} startContent={<Box size={16}/>}>
                                    {inst.name}
                                </SelectItem>
                            ))}
                        </Select>
                    </div>
                    <Button 
                        color="primary" 
                        size="lg"
                        className="px-8 font-bold shadow-lg shadow-primary/30 min-w-[160px]"
                        onPress={handleGenerate}
                        isLoading={isGenerating}
                        startContent={!isGenerating && <Send size={18} />}
                    >
                        Build & Deploy
                    </Button>
                </div>

                {isGenerating && (
                    <div className="space-y-2 py-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex justify-between text-xs font-bold text-primary">
                            <span>LLM is designing nodes...</span>
                            <span>Parsing connections...</span>
                        </div>
                        <Progress size="sm" isIndeterminate color="primary" />
                    </div>
                )}

                {result && (
                    <div className="mt-6 p-6 bg-white/50 dark:bg-black/20 rounded-2xl border border-primary/20 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle2 className="text-success" size={20} />
                            <h4 className="font-black text-lg">Deployment Successful</h4>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-default-100 p-4 rounded-xl">
                                <p className="text-sm leading-relaxed italic text-default-700">
                                    "{result.explanation}"
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Chip color="primary" variant="flat" size="sm" startContent={<Terminal size={12}/>}>
                                    Workflow ID: {result.workflowId}
                                </Chip>
                                <Chip color="success" variant="flat" size="sm">
                                    Status: ACTIVE
                                </Chip>
                            </div>

                            <Button 
                                variant="flat" 
                                color="primary" 
                                className="w-full font-bold"
                                endContent={<ExternalLink size={16} />}
                                onPress={() => window.open(`${instances.find(i => i.id === selectedInstance)?.url}/workflow/${result.workflowId}`, '_blank')}
                            >
                                Open in n8n Instance
                            </Button>
                        </div>
                    </div>
                )}
            </CardBody>
        </Card>
    );
}
