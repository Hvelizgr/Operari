'use client';

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Card, CardBody, Skeleton, Tab, Tabs, Button, Chip, Progress, Checkbox, CheckboxGroup } from "@heroui/react";
import { X, Zap, Mail, Database, Webhook, Code, FileText, Search, LayoutGrid, Sparkles, Filter, ArrowRight, GitBranch, Play, CheckCircle, Server, Send } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import { useTemplates, WorkflowTemplate } from '../../hooks/useTemplates';
import axios from 'axios';
import { toast } from 'sonner';

interface TemplateGalleryProps {
    onSelectTemplate: (nodes: WorkflowNode[], connections: Connection[]) => void;
    lang: 'en' | 'es';
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export default function TemplateGallery({ onSelectTemplate, lang, isOpen, onOpenChange }: TemplateGalleryProps) {
    const { templates: TEMPLATES, isLoading } = useTemplates();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedPreview, setSelectedPreview] = useState<WorkflowTemplate | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);

    const isEs = lang === 'es';

    const text = {
        title: isEs ? 'Marketplace de Plantillas' : 'Template Marketplace',
        subtitle: isEs ? 'Encuentra y utiliza flujos pre-construidos por la comunidad' : 'Find and use pre-built workflows from the community',
        search: isEs ? 'Buscar plantillas...' : 'Search templates...',
        all: isEs ? 'Todas' : 'All',
        use: isEs ? 'Usar Plantilla' : 'Use Template',
        empty: isEs ? 'No se encontraron plantillas' : 'No templates found',
        preview: isEs ? 'Vista Previa' : 'Preview',
        nodes: isEs ? 'Nodos' : 'Nodes',
        connections: isEs ? 'Conexiones' : 'Connections',
        loading: isEs ? 'Cargando...' : 'Loading...',
        howItWorks: isEs ? 'Cómo funciona' : 'How it works',
        step1: isEs ? 'Selecciona una plantilla' : 'Select a template',
        step2: isEs ? 'Se carga automáticamente' : 'Loads automatically',
        step3: isEs ? 'Personaliza y ejecuta' : 'Customize and run'
    };

    const categories = [
        { id: 'all', label: text.all, icon: LayoutGrid },
        { id: 'automation', label: isEs ? 'Automatización' : 'Automation', icon: Zap },
        { id: 'data', label: isEs ? 'Datos' : 'Data', icon: Database },
        { id: 'email', label: 'Email', icon: Mail },
        { id: 'webhooks', label: 'Webhooks', icon: Webhook },
        { id: 'ai', label: 'AI', icon: Sparkles },
    ];

    const filteredTemplates = useMemo(() => {
        return TEMPLATES.filter(t => {
            const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
            const matchesSearch = 
                t.name[lang]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.description?.[lang]?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [TEMPLATES, selectedCategory, searchQuery, lang]);

    const handleSelectTemplate = async (template: WorkflowTemplate) => {
        setLoadingTemplate(template.id);
        await new Promise(resolve => setTimeout(resolve, 800));
        onSelectTemplate(template.nodes, template.connections);
        setLoadingTemplate(null);
        onOpenChange?.(false);
    };

    useEffect(() => {
        if (!isOpen) {
            setSelectedPreview(null);
            setLoadingTemplate(null);
        }
    }, [isOpen]);

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'email': return <Mail size={16} />;
            case 'data': return <Database size={16} />;
            case 'webhooks': return <Webhook size={16} />;
            case 'automation': return <Zap size={16} />;
            case 'ai': return <Sparkles size={16} />;
            default: return <Code size={16} />;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'email': return 'primary';
            case 'data': return 'success';
            case 'webhooks': return 'warning';
            case 'automation': return 'secondary';
            case 'ai': return 'danger';
            default: return 'default';
        }
    };

    const [isFleetModalOpen, setIsFleetModalOpen] = useState(false);
    const [instances, setInstances] = useState<any[]>([]);
    const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
    const [isDeployingFleet, setIsDeployingFleet] = useState(false);

    useEffect(() => {
        if (isOpen) fetchInstances();
    }, [isOpen]);

    const fetchInstances = async () => {
        try {
            const response = await axios.get('/api/fleet/instances');
            if (Array.isArray(response.data)) {
                setInstances(response.data);
            } else {
                setInstances([]);
            }
        } catch (error) {
            console.error('Failed to fetch instances');
            setInstances([]);
        }
    };

    const handleDeployFleet = async () => {
        if (!selectedPreview || selectedInstances.length === 0) return;
        setIsDeployingFleet(true);
        try {
            await axios.post('/api/templates/deploy-fleet', {
                templateId: selectedPreview.id,
                instanceIds: selectedInstances
            });
            toast.success('Deployed to fleet successfully!');
            setIsFleetModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Fleet deployment failed');
        } finally {
            setIsDeployingFleet(false);
        }
    };

    return (
        <>
        <Modal 
            isOpen={isOpen} 
            onOpenChange={onOpenChange}
            size="full"
            scrollBehavior="inside"
            backdrop="blur"
            classNames={{
                base: "bg-slate-50 dark:bg-slate-950 max-h-[95vh] m-4",
                header: "border-b border-slate-200 dark:border-slate-800",
                body: "p-0"
            }}
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1 px-8 py-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                        <LayoutGrid size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold">{text.title}</h2>
                                        <p className="text-base font-normal text-slate-500">{text.subtitle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8 bg-slate-100 dark:bg-slate-800/50 rounded-2xl px-6 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-sm">1</div>
                                        <span className="text-sm text-slate-600 dark:text-slate-400">{text.step1}</span>
                                    </div>
                                    <ArrowRight size={16} className="text-slate-400" />
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 font-bold text-sm">2</div>
                                        <span className="text-sm text-slate-600 dark:text-slate-400">{text.step2}</span>
                                    </div>
                                    <ArrowRight size={16} className="text-slate-400" />
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500 font-bold text-sm">3</div>
                                        <span className="text-sm text-slate-600 dark:text-slate-400">{text.step3}</span>
                                    </div>
                                </div>
                            </div>
                        </ModalHeader>
                        <ModalBody>
                            <div className="flex h-full">
                                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10 py-3 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
                                        <div className="w-full md:w-auto">
                                            <Tabs 
                                                variant="underlined"
                                                selectedKey={selectedCategory}
                                                onSelectionChange={(key) => setSelectedCategory(key as string)}
                                                classNames={{
                                                    tabList: "gap-8",
                                                    cursor: "w-full bg-blue-500",
                                                    tab: "max-w-fit px-0 h-14",
                                                    tabContent: "group-data-[selected=true]:text-blue-500 text-slate-500 font-semibold text-base"
                                                }}
                                            >
                                                {categories.map((c) => (
                                                    <Tab 
                                                        key={c.id} 
                                                        title={
                                                            <div className="flex items-center gap-2">
                                                                <c.icon size={18} />
                                                                <span>{c.label}</span>
                                                            </div>
                                                        }
                                                    />
                                                ))}
                                            </Tabs>
                                        </div>
                                        <Input
                                            className="w-full md:max-w-sm"
                                            placeholder={text.search}
                                            startContent={<Search size={20} className="text-slate-400" />}
                                            value={searchQuery}
                                            onValueChange={setSearchQuery}
                                            variant="bordered"
                                            size="lg"
                                            classNames={{
                                                inputWrapper: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-12"
                                            }}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 py-6 overflow-y-auto flex-1">
                                        {isLoading ? (
                                            Array.from({ length: 6 }).map((_, i) => (
                                                <Card key={i} className="h-64">
                                                    <CardBody className="gap-4 p-6">
                                                        <Skeleton className="h-8 w-3/4 rounded-lg" />
                                                        <Skeleton className="h-16 w-full rounded-lg" />
                                                        <Skeleton className="h-10 w-1/2 rounded-lg mt-auto" />
                                                    </CardBody>
                                                </Card>
                                            ))
                                        ) : filteredTemplates.length === 0 ? (
                                            <div className="col-span-full py-24 flex flex-col items-center gap-6 text-slate-500">
                                                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                    <Filter size={48} className="opacity-30" />
                                                </div>
                                                <p className="text-2xl font-medium">{text.empty}</p>
                                            </div>
                                        ) : (
                                            filteredTemplates.map((template) => (
                                                <Card
                                                    key={template.id}
                                                    isPressable
                                                    onPress={() => setSelectedPreview(template)}
                                                    className={`group border-2 transition-all shadow-sm hover:shadow-2xl h-full min-h-[280px] ${
                                                        selectedPreview?.id === template.id 
                                                            ? 'border-blue-500 shadow-blue-500/20' 
                                                            : 'border-slate-200 dark:border-slate-800 hover:border-blue-400'
                                                    }`}
                                                >
                                                    <CardBody className="p-6 flex flex-col h-full">
                                                        <div className="flex justify-between items-start mb-4">
                                                        <div className={`p-3 rounded-xl transition-colors ${
                                                            selectedPreview?.id === template.id 
                                                                ? 'bg-blue-500 text-white' 
                                                                : `bg-${getCategoryColor(template.category || 'default')}-500/10 text-${getCategoryColor(template.category || 'default')}-500 group-hover:bg-blue-500 group-hover:text-white`
                                                        }`}>
                                                            {getCategoryIcon(template.category || 'default')}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Chip size="sm" variant="flat" className="bg-slate-100 dark:bg-slate-800">
                                                                    <div className="flex items-center gap-1">
                                                                        <GitBranch size={12} />
                                                                        <span>{template.nodes?.length || 0}</span>
                                                                    </div>
                                                                </Chip>
                                                            </div>
                                                        </div>

                                                        <h3 className="text-xl font-bold mb-3 line-clamp-2 group-hover:text-blue-500 transition-colors">
                                                            {template.name[lang] || template.name['en']}
                                                        </h3>

                                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-3 flex-1">
                                                            {template.description?.[lang] || template.description?.['en'] || ''}
                                                        </p>

                                                        <div className="mt-auto flex items-center justify-between">
                                                            <Chip 
                                                                size="sm" 
                                                                variant="flat" 
                                                                className={`bg-${getCategoryColor(template.category || 'default')}-500/10 text-${getCategoryColor(template.category || 'default')}-500 capitalize`}
                                                            >
                                                                {template.category || 'other'}
                                                            </Chip>
                                                            {loadingTemplate === template.id ? (
                                                                <div className="flex items-center gap-2 text-blue-500">
                                                                    <Progress 
                                                                        size="sm" 
                                                                        isIndeterminate 
                                                                        color="primary"
                                                                        className="w-16"
                                                                    />
                                                                    <span className="text-sm">{text.loading}</span>
                                                                </div>
                                                            ) : (
                                                                  <span
                                                                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                                                                          selectedPreview?.id === template.id 
                                                                              ? 'bg-blue-500 text-white' 
                                                                              : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white'
                                                                      }`}
                                                                      onClick={(e) => {
                                                                          e.stopPropagation();
                                                                          handleSelectTemplate(template);
                                                                      }}
                                                                  >
                                                                      {text.use}
                                                                      <Play size={14} />
                                                                  </span>
                                                              )}
                                                        </div>
                                                    </CardBody>
                                                </Card>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {selectedPreview && (
                                    <div className="w-[450px] border-l border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 p-6 flex flex-col">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold">{text.preview}</h3>
                                            <button 
                                                onClick={() => setSelectedPreview(null)}
                                                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto space-y-6">
                                            <div>
                                                <h4 className="text-2xl font-bold mb-2">
                                                    {selectedPreview.name[lang] || selectedPreview.name['en']}
                                                </h4>
                                                <p className="text-slate-500">
                                                    {selectedPreview.description?.[lang] || selectedPreview.description?.['en'] || ''}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center">
                                                    <div className="text-3xl font-bold text-blue-500 mb-1">
                                                        {selectedPreview.nodes?.length || 0}
                                                    </div>
                                                    <div className="text-sm text-slate-500">{text.nodes}</div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center">
                                                    <div className="text-3xl font-bold text-purple-500 mb-1">
                                                        {selectedPreview.connections?.length || 0}
                                                    </div>
                                                    <div className="text-sm text-slate-500">{text.connections}</div>
                                                </div>
                                            </div>

                                            <div>
                                                <h5 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">
                                                    {isEs ? 'Nodos incluidos' : 'Included Nodes'}
                                                </h5>
                                                <div className="space-y-2">
                                                    {selectedPreview.nodes?.slice(0, 8).map((node, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-lg p-3"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                                <Code size={14} className="text-slate-500" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-sm truncate">{node.title}</div>
                                                                <div className="text-xs text-slate-500 truncate">{node.type.replace('n8n-nodes-base.', '')}</div>
                                                            </div>
                                                            <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                                                        </div>
                                                    ))}
                                                    {(selectedPreview.nodes?.length || 0) > 8 && (
                                                        <div className="text-center text-sm text-slate-500 py-2">
                                                            +{(selectedPreview.nodes?.length || 0) - 8} {isEs ? 'más' : 'more'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                            <div className="flex flex-col gap-2 mt-6">
                                                <Button
                                                    color="primary"
                                                    size="lg"
                                                    className="font-bold text-base w-full"
                                                    isLoading={loadingTemplate === selectedPreview.id}
                                                    onPress={() => handleSelectTemplate(selectedPreview)}
                                                    endContent={!loadingTemplate && <Play size={18} />}
                                                >
                                                    {loadingTemplate ? text.loading : text.use}
                                                </Button>
                                                
                                                <Button
                                                    variant="flat"
                                                    color="secondary"
                                                    size="lg"
                                                    className="font-bold text-base w-full"
                                                    onPress={() => setIsFleetModalOpen(true)}
                                                    startContent={<Server size={18} />}
                                                >
                                                    Deploy to Fleet
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Fleet Deployment Modal */}
            <Modal isOpen={isFleetModalOpen} onOpenChange={setIsFleetModalOpen} size="lg">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1 text-2xl font-black">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">Fleet Orchestrator</span>
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-500 mb-4">
                                    Select the n8n instances where you want to push this blueprint. This will create a new workflow in each instance.
                                </p>
                                
                                <div className="space-y-4 max-h-[400px] overflow-y-auto p-1">
                                    <CheckboxGroup
                                        label="Target Instances"
                                        value={selectedInstances}
                                        onValueChange={setSelectedInstances}
                                    >
                                        {instances.map(inst => (
                                            <div key={inst.id} className="flex items-center justify-between p-3 bg-default-50 rounded-xl border border-default-200">
                                                <Checkbox value={inst.id}>
                                                    <div className="ml-2">
                                                        <p className="font-bold text-sm">{inst.name}</p>
                                                        <p className="text-[10px] text-default-400 font-mono">{inst.url}</p>
                                                    </div>
                                                </Checkbox>
                                                <Chip size="sm" variant="flat" color={inst.environment === 'PRODUCTION' ? 'danger' : inst.environment === 'STAGING' ? 'warning' : 'primary'}>
                                                    {inst.environment}
                                                </Chip>
                                            </div>
                                        ))}
                                    </CheckboxGroup>
                                </div>
                            </ModalBody>
                            <ModalFooter className="border-t border-default-100">
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button 
                                    color="secondary" 
                                    className="font-bold px-8 shadow-lg shadow-secondary/20"
                                    isLoading={isDeployingFleet}
                                    onPress={handleDeployFleet}
                                    isDisabled={selectedInstances.length === 0}
                                    startContent={!isDeployingFleet && <Send size={18} />}
                                >
                                    Push to {selectedInstances.length} Instances
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
}

