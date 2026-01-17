'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Mail, Database, Webhook, Code, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import { useTemplates, WorkflowTemplate } from '../../hooks/useTemplates';


interface TemplateGalleryProps {
    onSelectTemplate: (nodes: WorkflowNode[], connections: Connection[]) => void;
    lang: 'en' | 'es';
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export default function TemplateGallery({ onSelectTemplate, lang, isOpen: controlledIsOpen, onOpenChange }: TemplateGalleryProps) {
    const { templates: TEMPLATES, isLoading } = useTemplates();
    const [internalIsOpen, setInternalIsOpen] = useState(false);

    // Support both controlled and uncontrolled modes
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const setIsOpen = (open: boolean) => {
        if (onOpenChange) {
            onOpenChange(open);
        } else {
            setInternalIsOpen(open);
        }
    };
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const content = {
        en: {
            title: 'Workflow Templates',
            subtitle: 'Start with a pre-built template',
            all: 'All',
            email: 'Email',
            data: 'Data',
            webhooks: 'Webhooks',
            automation: 'Automation',
            useTemplate: 'Use Template',
            close: 'Close',
            openGallery: 'Templates',
        },
        es: {
            title: 'Plantillas de Flujo',
            subtitle: 'Comienza con una plantilla predefinida',
            all: 'Todas',
            email: 'Email',
            data: 'Datos',
            webhooks: 'Webhooks',
            automation: 'Automatización',
            useTemplate: 'Usar Plantilla',
            close: 'Cerrar',
            openGallery: 'Plantillas',
        },
    };

    const text = content[lang] || content['en'];

    const categories = [
        { id: 'all', label: text.all, icon: FileText },
        { id: 'email', label: text.email, icon: Mail },
        { id: 'data', label: text.data, icon: Database },
        { id: 'webhooks', label: text.webhooks, icon: Webhook },
        { id: 'automation', label: text.automation, icon: Zap },
    ];

    const filteredTemplates = selectedCategory === 'all'
        ? TEMPLATES
        : TEMPLATES.filter(t => t.category === selectedCategory);

    const handleSelectTemplate = (template: WorkflowTemplate) => {
        onSelectTemplate(template.nodes, template.connections);
        setIsOpen(false);
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'email': return <Mail size={16} />;
            case 'data': return <Database size={16} />;
            case 'webhooks': return <Webhook size={16} />;
            case 'automation': return <Zap size={16} />;
            default: return <Code size={16} />;
        }
    };

    // Hide the internal button when controlled externally
    const showInternalButton = controlledIsOpen === undefined;

    return (
        <>
            {showInternalButton && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="absolute top-20 left-4 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg shadow-lg z-40 transition-colors"
                    style={{
                        backgroundColor: 'var(--box-background-color)',
                        color: 'var(--body-text-color)',
                        border: '1px solid var(--border-color)',
                    }}
                >
                    <FileText size={16} style={{ color: 'var(--label-color)' }} />
                    {text.openGallery}
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                        <motion.div
                            className="relative rounded-xl shadow-2xl p-6 max-w-5xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
                            style={{
                                backgroundColor: 'var(--box-background-color)',
                                border: '1px solid var(--border-color)',
                            }}
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold" style={{ color: 'var(--body-text-color)' }}>{text.title}</h2>
                                    <p className="text-sm mt-1" style={{ color: 'var(--label-color)' }}>{text.subtitle}</p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="transition-colors hover:opacity-80"
                                    style={{ color: 'var(--label-color)' }}
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mb-6">
                                {categories.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors`}
                                        style={{
                                            backgroundColor: selectedCategory === category.id ? 'var(--blue)' : 'transparent',
                                            color: selectedCategory === category.id ? '#fff' : 'var(--label-color)',
                                            border: selectedCategory === category.id ? 'none' : '1px solid var(--border-color)',
                                        }}
                                    >
                                        <category.icon size={16} />
                                        {category.label}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-1">
                                {isLoading ? (
                                    <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center h-64 text-slate-400">
                                        <Loader2 className="animate-spin mb-4" size={32} />
                                        <p>Loading templates...</p>
                                    </div>
                                ) : filteredTemplates.length === 0 ? (
                                    <div className="col-span-1 md:col-span-2 lg:col-span-3 flex items-center justify-center h-64 text-slate-500">
                                        <p>No templates found.</p>
                                    </div>
                                ) : (
                                    filteredTemplates.map((template) => (
                                        <motion.div
                                            key={template.id}
                                            className="rounded-lg p-4 transition-all cursor-pointer group"
                                            style={{
                                                backgroundColor: 'var(--form-background-color)',
                                                border: '1px solid var(--border-color)',
                                            }}
                                            whileHover={{ scale: 1.02, borderColor: 'var(--blue)' }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleSelectTemplate(template)}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div style={{ color: 'var(--icon-color)' }}>
                                                        {getCategoryIcon(template.category)}
                                                    </div>
                                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--body-text-color)' }}>
                                                        {template.name[lang]}
                                                    </h3>
                                                </div>
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--box-background-color)', color: 'var(--label-color)', border: '1px solid var(--border-color)' }}>
                                                    {template.nodes.length} nodes
                                                </span>
                                            </div>
                                            <p className="text-xs mb-4" style={{ color: 'var(--label-color)' }}>
                                                {template.description[lang]}
                                            </p>
                                            <button
                                                className="w-full px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                style={{ backgroundColor: 'var(--blue)' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectTemplate(template);
                                                }}
                                            >
                                                {text.useTemplate}
                                            </button>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
