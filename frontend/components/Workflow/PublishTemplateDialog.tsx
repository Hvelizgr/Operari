'use client';

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Textarea, Select, SelectItem } from "@heroui/react";
import { useState } from 'react';
import { Globe, Tag, Info } from "lucide-react";

interface PublishTemplateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (data: any) => Promise<void>;
    lang: 'en' | 'es';
    workflowName: string;
}

export default function PublishTemplateDialog({ isOpen, onClose, onPublish, lang, workflowName }: PublishTemplateDialogProps) {
    const [name, setName] = useState(workflowName);
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('automation');
    const [isLoading, setIsLoading] = useState(false);

    const isEs = lang === 'es';

    const handlePublish = async () => {
        setIsLoading(true);
        try {
            await onPublish({
                name: { en: name, es: name },
                description: { en: description, es: description },
                category,
                isPublic: true
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" backdrop="blur">
            <ModalContent className="bg-white dark:bg-slate-900">
                <ModalHeader className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Globe className="text-blue-500" size={18} />
                        </div>
                        <span className="text-xl font-bold">{isEs ? 'Publicar en Marketplace' : 'Publish to Marketplace'}</span>
                    </div>
                </ModalHeader>
                <ModalBody className="py-6">
                    <div className="space-y-6">
                        <Input
                            label={isEs ? 'Nombre de la Plantilla' : 'Template Name'}
                            value={name}
                            onValueChange={setName}
                            variant="bordered"
                            placeholder={isEs ? 'Ej: Procesador de Pedidos' : 'e.g. Order Processor'}
                            classNames={{
                                label: "text-slate-500 font-medium",
                                input: "text-slate-900 dark:text-white",
                                inputWrapper: "border-slate-200 dark:border-slate-700"
                            }}
                        />
                        <Textarea
                            label={isEs ? 'Descripción' : 'Description'}
                            value={description}
                            onValueChange={setDescription}
                            variant="bordered"
                            placeholder={isEs ? 'Describe qué hace este flujo...' : 'Describe what this workflow does...'}
                            classNames={{
                                label: "text-slate-500 font-medium",
                                input: "text-slate-900 dark:text-white",
                                inputWrapper: "border-slate-200 dark:border-slate-700"
                            }}
                        />
                        <Select 
                            label={isEs ? 'Categoría' : 'Category'}
                            variant="bordered"
                            selectedKeys={[category]}
                            onSelectionChange={(keys) => setCategory(Array.from(keys)[0] as string)}
                            classNames={{
                                label: "text-slate-500 font-medium",
                                trigger: "border-slate-200 dark:border-slate-700"
                            }}
                        >
                            <SelectItem key="automation">{isEs ? 'Automatización' : 'Automation'}</SelectItem>
                            <SelectItem key="data">{isEs ? 'Datos' : 'Data'}</SelectItem>
                            <SelectItem key="email">Email</SelectItem>
                            <SelectItem key="webhooks">Webhooks</SelectItem>
                            <SelectItem key="ai">AI</SelectItem>
                        </Select>
                        
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl flex gap-3 text-sm text-blue-800 dark:text-blue-300">
                            <Info size={20} className="shrink-0 mt-0.5 text-blue-500" />
                            <div className="space-y-1">
                                <p className="font-semibold">{isEs ? "Aviso de Seguridad" : "Security Notice"}</p>
                                <p className="leading-relaxed opacity-90">
                                    {isEs 
                                        ? "Al publicar, tu flujo será visible para todos los usuarios. Asegúrate de eliminar cualquier dato sensible o credencial específica."
                                        : "By publishing, your workflow will be visible to all users. Make sure to remove any sensitive data or specific credentials."}
                                </p>
                            </div>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <Button variant="flat" onPress={onClose} className="font-medium text-slate-600 dark:text-slate-300">
                        {isEs ? 'Cancelar' : 'Cancel'}
                    </Button>
                    <Button 
                        color="primary" 
                        onPress={handlePublish} 
                        isLoading={isLoading}
                        className="font-bold shadow-lg shadow-blue-500/20"
                    >
                        {isEs ? 'Publicar Ahora' : 'Publish Now'}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
