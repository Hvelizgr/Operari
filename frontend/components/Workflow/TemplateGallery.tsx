'use client';

import { Modal, ModalContent, ModalHeader, ModalBody, Input, Card, CardBody, Skeleton, Tab, Tabs } from "@heroui/react";
import { X, Zap, Mail, Database, Webhook, Code, FileText, Search, LayoutGrid, Sparkles, Filter } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import { useTemplates, WorkflowTemplate } from '../../hooks/useTemplates';

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

    const isEs = lang === 'es';

    const text = {
        title: isEs ? 'Marketplace de Plantillas' : 'Template Marketplace',
        subtitle: isEs ? 'Encuentra y utiliza flujos pre-construidos por la comunidad' : 'Find and use pre-built workflows from the community',
        search: isEs ? 'Buscar plantillas...' : 'Search templates...',
        all: isEs ? 'Todas' : 'All',
        use: isEs ? 'Usar Plantilla' : 'Use Template',
        empty: isEs ? 'No se encontraron plantillas' : 'No templates found'
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
                t.description[lang]?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [TEMPLATES, selectedCategory, searchQuery, lang]);

    const handleSelectTemplate = (template: WorkflowTemplate) => {
        onSelectTemplate(template.nodes, template.connections);
        onOpenChange?.(false);
    };

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

    return (
        <Modal 
            isOpen={isOpen} 
            onOpenChange={onOpenChange}
            size="5xl"
            scrollBehavior="inside"
            backdrop="blur"
            classNames={{
                base: "bg-slate-50 dark:bg-slate-950 max-h-[90vh]",
                header: "border-b border-slate-200 dark:border-slate-800",
                body: "p-6"
            }}
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                                    <LayoutGrid size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{text.title}</h2>
                                    <p className="text-sm font-normal text-slate-500">{text.subtitle}</p>
                                </div>
                            </div>
                        </ModalHeader>
                        <ModalBody>
                            <div className="flex flex-col gap-6">
                                {/* Filters & Search */}
                                <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10 py-2 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
                                    <div className="w-full md:w-auto">
                                        <Tabs 
                                            variant="underlined"
                                            selectedKey={selectedCategory}
                                            onSelectionChange={(key) => setSelectedCategory(key as string)}
                                            classNames={{
                                                tabList: "gap-6",
                                                cursor: "w-full bg-blue-500",
                                                tab: "max-w-fit px-0 h-12",
                                                tabContent: "group-data-[selected=true]:text-blue-500 text-slate-500 font-semibold"
                                            }}
                                        >
                                            {categories.map((c) => (
                                                <Tab 
                                                    key={c.id} 
                                                    title={
                                                        <div className="flex items-center gap-2">
                                                            <c.icon size={16} />
                                                            <span>{c.label}</span>
                                                        </div>
                                                    }
                                                />
                                            ))}
                                        </Tabs>
                                    </div>
                                    <Input
                                        className="w-full md:max-w-xs"
                                        placeholder={text.search}
                                        startContent={<Search size={18} className="text-slate-400" />}
                                        value={searchQuery}
                                        onValueChange={setSearchQuery}
                                        variant="bordered"
                                        classNames={{
                                            inputWrapper: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                        }}
                                    />
                                </div>

                                {/* Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                                    {isLoading ? (
                                        Array.from({ length: 6 }).map((_, i) => (
                                            <Card key={i} className="h-48">
                                                <CardBody className="gap-3">
                                                    <Skeleton className="h-6 w-3/4 rounded-lg" />
                                                    <Skeleton className="h-12 w-full rounded-lg" />
                                                    <Skeleton className="h-8 w-1/2 rounded-lg mt-auto" />
                                                </CardBody>
                                            </Card>
                                        ))
                                    ) : filteredTemplates.length === 0 ? (
                                        <div className="col-span-full py-20 flex flex-col items-center gap-4 text-slate-500">
                                            <Filter size={48} className="opacity-20" />
                                            <p className="text-xl font-medium">{text.empty}</p>
                                        </div>
                                    ) : (
                                        filteredTemplates.map((template) => (
                                            <Card
                                                key={template.id}
                                                isPressable
                                                onPress={() => handleSelectTemplate(template)}
                                                className="group border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all shadow-sm hover:shadow-xl hover:shadow-blue-500/10 h-full"
                                            >
                                                <CardBody className="p-5 flex flex-col h-full">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className={`p-2 rounded-lg bg-${getCategoryColor(template.category)}-500/10 text-${getCategoryColor(template.category)}-500 group-hover:bg-blue-500 group-hover:text-white transition-colors`}>
                                                            {getCategoryIcon(template.category)}
                                                        </div>
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-default-100 text-default-600">
                                                            {template.nodes?.length || 0} Nodes
                                                        </span>
                                                    </div>

                                                    <h3 className="text-lg font-bold mb-2 line-clamp-1 group-hover:text-blue-500 transition-colors">
                                                        {template.name[lang] || template.name['en']}
                                                    </h3>

                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-3">
                                                        {template.description[lang] || template.description['en']}
                                                    </p>

                                                    <div className="mt-auto flex items-center justify-between">
                                                        <div className="flex -space-x-2">
                                                            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-gradient-to-tr from-slate-200 to-slate-300" />
                                                            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-gradient-to-tr from-blue-400 to-blue-500" />
                                                        </div>
                                                        <span
                                                            className="font-bold hidden group-hover:inline-flex items-center justify-center px-3 py-1 text-sm rounded-lg bg-primary text-primary-foreground animate-in fade-in zoom-in duration-200"
                                                        >
                                                            {text.use}
                                                        </span>
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            </div>
                        </ModalBody>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
