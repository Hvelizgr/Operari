'use client';

import { useState, useEffect } from 'react';
import { 
    Card, CardBody, Button, Input, Textarea, Select, SelectItem, 
    Tabs, Tab, Chip, Switch, Slider, Divider, Avatar,
    ScrollShadow, Tooltip, Badge
} from '@heroui/react';
import { 
    Bot, Brain, Wand2, Database, History, Save, Play, 
    Settings, Plus, Trash2, Cpu, Sparkles, MessageSquare,
    Zap, Shield, Globe, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentConfig {
    id?: string;
    name: string;
    description: string;
    avatar?: string;
    model: string;
    provider: 'openai' | 'anthropic' | 'google' | 'groq';
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    tools: string[];
    knowledge: string[];
    memory: 'none' | 'short_term' | 'long_term' | 'vector';
}

const MODELS = {
    openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
    google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    groq: ['llama-3-70b', 'mixtral-8x7b']
};

export default function AgentDesigner() {
    const [config, setConfig] = useState<AgentConfig>({
        name: 'New Agent',
        description: 'An AI agent designed to help with specific tasks.',
        model: 'gpt-4o',
        provider: 'openai',
        systemPrompt: 'You are a helpful assistant specialized in...',
        temperature: 0.7,
        maxTokens: 2000,
        tools: [],
        knowledge: [],
        memory: 'short_term'
    });

    const [activeTab, setActiveTab] = useState('identity');
    const [isSaving, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col h-full gap-6 max-w-6xl mx-auto p-6">
            <header className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                        <Bot size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Agent Designer</h1>
                        <p className="text-slate-500 text-sm">Configure your autonomous AI agent capabilities</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="bordered" startContent={<Play size={18} />}>
                        Test Agent
                    </Button>
                    <Button 
                        color="primary" 
                        startContent={<Save size={18} />} 
                        isLoading={isSaving}
                        onPress={handleSave}
                        className="font-bold"
                    >
                        Save Agent
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Left Side: Configuration */}
                <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden">
                    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
                        <CardBody className="p-0">
                            <Tabs 
                                aria-label="Agent Configuration" 
                                selectedKey={activeTab}
                                onSelectionChange={(key) => setActiveTab(key as string)}
                                variant="underlined"
                                color="primary"
                                classNames={{
                                    tabList: "px-6 border-b border-slate-100 dark:border-slate-800 gap-6",
                                    cursor: "w-full bg-blue-600",
                                    tab: "max-w-fit px-0 h-14",
                                    tabContent: "group-data-[selected=true]:text-blue-600 font-semibold"
                                }}
                            >
                                <Tab
                                    key="identity"
                                    title={
                                        <div className="flex items-center space-x-2">
                                            <Bot size={18} />
                                            <span>Identity</span>
                                        </div>
                                    }
                                />
                                <Tab
                                    key="brain"
                                    title={
                                        <div className="flex items-center space-x-2">
                                            <Brain size={18} />
                                            <span>Brain & LLM</span>
                                        </div>
                                    }
                                />
                                <Tab
                                    key="capabilities"
                                    title={
                                        <div className="flex items-center space-x-2">
                                            <Wand2 size={18} />
                                            <span>Tools & Knowledge</span>
                                        </div>
                                    }
                                />
                                <Tab
                                    key="memory"
                                    title={
                                        <div className="flex items-center space-x-2">
                                            <History size={18} />
                                            <span>Memory</span>
                                        </div>
                                    }
                                />
                            </Tabs>

                            <ScrollShadow className="p-6 max-h-[600px]">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'identity' && (
                                        <motion.div
                                            key="identity"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="space-y-6"
                                        >
                                            <div className="flex items-center gap-6">
                                                <Avatar 
                                                    src={config.avatar} 
                                                    className="w-24 h-24 text-large ring-2 ring-blue-500/20 bg-slate-100 dark:bg-slate-800"
                                                    fallback={<Bot size={40} className="text-slate-400" />}
                                                />
                                                <div className="flex-1 space-y-2">
                                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Agent Name</label>
                                                    <Input 
                                                        placeholder="e.g. Sales Assistant" 
                                                        value={config.name}
                                                        onValueChange={(val) => setConfig({...config, name: val})}
                                                        variant="bordered"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Description</label>
                                                <Textarea 
                                                    placeholder="What is this agent's purpose?" 
                                                    value={config.description}
                                                    onValueChange={(val) => setConfig({...config, description: val})}
                                                    variant="bordered"
                                                    minRows={3}
                                                />
                                            </div>
                                        </motion.div>
                                    )}

                                    {activeTab === 'brain' && (
                                        <motion.div
                                            key="brain"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="space-y-6"
                                        >
                                            <div className="grid grid-cols-2 gap-4">
                                                <Select 
                                                    label="Provider" 
                                                    variant="bordered"
                                                    selectedKeys={[config.provider]}
                                                    onSelectionChange={(keys) => {
                                                        const p = Array.from(keys)[0] as string;
                                                        if (p && p in MODELS) {
                                                            const providerKey = p as keyof typeof MODELS;
                                                            setConfig({
                                                                ...config, 
                                                                provider: providerKey, 
                                                                model: MODELS[providerKey][0]
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <SelectItem key="openai" startContent={<Zap size={16} className="text-green-500" />}>OpenAI</SelectItem>
                                                    <SelectItem key="anthropic" startContent={<Shield size={16} className="text-orange-500" />}>Anthropic</SelectItem>
                                                    <SelectItem key="google" startContent={<Globe size={16} className="text-blue-500" />}>Google</SelectItem>
                                                    <SelectItem key="groq" startContent={<Cpu size={16} className="text-purple-500" />}>Groq</SelectItem>
                                                </Select>
                                                <Select 
                                                    label="Model" 
                                                    variant="bordered"
                                                    selectedKeys={[config.model]}
                                                    onSelectionChange={(keys) => setConfig({...config, model: Array.from(keys)[0] as string})}
                                                >
                                                    {MODELS[config.provider].map(m => (
                                                        <SelectItem key={m}>{m}</SelectItem>
                                                    ))}
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">System Prompt</label>
                                                    <Chip size="sm" variant="flat" color="primary" className="cursor-pointer hover:bg-blue-100">Use Template</Chip>
                                                </div>
                                                <Textarea 
                                                    placeholder="Define how the agent should behave..." 
                                                    value={config.systemPrompt}
                                                    onValueChange={(val) => setConfig({...config, systemPrompt: val})}
                                                    variant="bordered"
                                                    minRows={10}
                                                    classNames={{
                                                        input: "font-mono text-sm"
                                                    }}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <div className="flex justify-between">
                                                        <label className="text-xs font-bold uppercase text-slate-500">Temperature</label>
                                                        <span className="text-xs font-bold text-blue-600">{config.temperature}</span>
                                                    </div>
                                                    <Slider 
                                                        step={0.1} 
                                                        maxValue={1} 
                                                        minValue={0} 
                                                        aria-label="Temperature"
                                                        value={config.temperature}
                                                        onChange={(val) => setConfig({...config, temperature: val as number})}
                                                        size="sm"
                                                    />
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between">
                                                        <label className="text-xs font-bold uppercase text-slate-500">Max Tokens</label>
                                                        <span className="text-xs font-bold text-blue-600">{config.maxTokens}</span>
                                                    </div>
                                                    <Slider 
                                                        step={100} 
                                                        maxValue={8000} 
                                                        minValue={500} 
                                                        aria-label="Max Tokens"
                                                        value={config.maxTokens}
                                                        onChange={(val) => setConfig({...config, maxTokens: val as number})}
                                                        size="sm"
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {activeTab === 'capabilities' && (
                                        <motion.div
                                            key="capabilities"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="space-y-8"
                                        >
                                            <section className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <Wand2 size={18} className="text-amber-500" />
                                                        <h3 className="font-bold">Tools & Skills</h3>
                                                    </div>
                                                    <Button size="sm" variant="flat" color="primary" startContent={<Plus size={14} />}>Add Tool</Button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {['Web Search', 'Data Analysis', 'Image Generation', 'Email Sender'].map(tool => (
                                                        <div key={tool} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                                                                    <Cpu size={14} />
                                                                </div>
                                                                <span className="text-sm font-medium">{tool}</span>
                                                            </div>
                                                            <Switch size="sm" defaultSelected />
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>

                                            <section className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <Database size={18} className="text-blue-500" />
                                                        <h3 className="font-bold">Knowledge Base (RAG)</h3>
                                                    </div>
                                                    <Button size="sm" variant="flat" color="primary" startContent={<Plus size={14} />}>Connect Data</Button>
                                                </div>
                                                <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                                                    <Database size={32} className="mx-auto mb-3 text-slate-300" />
                                                    <p className="text-sm text-slate-500">No knowledge sources connected. <br/>Upload documents to give the agent custom info.</p>
                                                </div>
                                            </section>
                                        </motion.div>
                                    )}

                                    {activeTab === 'memory' && (
                                        <motion.div
                                            key="memory"
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="space-y-6"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Card 
                                                    isPressable 
                                                    className={`border-2 ${config.memory === 'short_term' ? 'border-blue-500 bg-blue-50/10' : 'border-transparent'}`}
                                                    onPress={() => setConfig({...config, memory: 'short_term'})}
                                                >
                                                    <CardBody className="p-4 flex flex-row items-center gap-4">
                                                        <div className={`p-3 rounded-xl ${config.memory === 'short_term' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                            <History size={20} />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="font-bold">Short-term Memory</p>
                                                            <p className="text-xs text-slate-500">Remembers only the current conversation.</p>
                                                        </div>
                                                    </CardBody>
                                                </Card>
                                                <Card 
                                                    isPressable 
                                                    className={`border-2 ${config.memory === 'long_term' ? 'border-purple-500 bg-purple-50/10' : 'border-transparent'}`}
                                                    onPress={() => setConfig({...config, memory: 'long_term'})}
                                                >
                                                    <CardBody className="p-4 flex flex-row items-center gap-4">
                                                        <div className={`p-3 rounded-xl ${config.memory === 'long_term' ? 'bg-purple-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                            <Database size={20} />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="font-bold">Long-term Memory</p>
                                                            <p className="text-xs text-slate-500">Persistent memory across sessions.</p>
                                                        </div>
                                                    </CardBody>
                                                </Card>
                                            </div>

                                            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex gap-3">
                                                <Settings size={18} className="text-amber-500 mt-0.5" />
                                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                                    Memory persistence requires a configured Vector Database or NanoFlow Managed Storage.
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </ScrollShadow>
                        </CardBody>
                    </Card>
                </div>

                {/* Right Side: Preview & Summary */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-slate-900 text-white border-none shadow-xl">
                        <CardBody className="p-6 space-y-6">
                            <div className="flex items-center gap-4">
                                <Avatar 
                                    className="w-16 h-16 ring-4 ring-blue-500/30" 
                                    icon={<Bot size={32} />}
                                    src={config.avatar}
                                />
                                <div>
                                    <h2 className="font-bold text-lg">{config.name}</h2>
                                    <div className="flex gap-2 mt-1">
                                        <Chip size="sm" variant="flat" color="primary" className="text-white bg-blue-500/20">{config.provider}</Chip>
                                        <Chip size="sm" variant="flat" color="success" className="text-white bg-green-500/20">{config.model}</Chip>
                                    </div>
                                </div>
                            </div>
                            
                            <Divider className="bg-white/10" />
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-bold uppercase tracking-widest">Capabilities</span>
                                    <span className="text-blue-400">{config.tools.length || 4} Tools</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge content="" color="success" shape="circle" placement="bottom-right">
                                        <Chip size="sm" variant="bordered" className="border-white/20 text-white">Search</Chip>
                                    </Badge>
                                    <Chip size="sm" variant="bordered" className="border-white/20 text-white">Python</Chip>
                                    <Chip size="sm" variant="bordered" className="border-white/20 text-white">Files</Chip>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                                <div className="flex items-center gap-2 text-blue-400">
                                    <MessageSquare size={16} />
                                    <span className="text-xs font-bold uppercase tracking-tighter">Preview Chat</span>
                                </div>
                                <div className="text-sm text-slate-400 italic">
                                    "Hello! I am ready to help you based on my configured skills."
                                </div>
                                <Input 
                                    placeholder="Test your agent..." 
                                    size="sm"
                                    variant="bordered"
                                    className="text-white"
                                    classNames={{
                                        inputWrapper: "border-white/20 hover:border-white/40 group-data-[focus=true]:border-blue-500"
                                    }}
                                    endContent={<Send size={14} className="text-slate-500" />}
                                />
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardBody className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-500 uppercase">Audit & Logs</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                All interactions with this agent will be tracked in the Enterprise Audit Log.
                            </p>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}
