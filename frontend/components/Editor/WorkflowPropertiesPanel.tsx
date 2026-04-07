'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Clock, ToggleLeft, ToggleRight, Save, Tag } from 'lucide-react';
import { useState, useEffect } from 'react';
import CronPicker from './CronPicker';
import TriggersPanel from './TriggersPanel';

export interface WorkflowProperties {
    id?: string;
    name: string;
    description: string;
    isActive: boolean;
    schedule: string | null;
    tags?: string[];
    errorHandling?: 'stop' | 'continue' | 'retry';
    timeout?: number;
    retryCount?: number;
    retryDelay?: number;
}

interface WorkflowPropertiesPanelProps {
    isOpen: boolean;
    properties: WorkflowProperties;
    onUpdate: (updates: Partial<WorkflowProperties>) => void;
    onClose: () => void;
    onSave?: () => void;
    lang: 'en' | 'es';
}

export default function WorkflowPropertiesPanel({
    isOpen,
    properties,
    onUpdate,
    onClose,
    onSave,
    lang
}: WorkflowPropertiesPanelProps) {
    const [localProps, setLocalProps] = useState<WorkflowProperties>(properties);
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        setLocalProps(properties);
    }, [properties]);

    const handleChange = (key: keyof WorkflowProperties, value: any) => {
        const updated = { ...localProps, [key]: value };
        setLocalProps(updated);
        onUpdate({ [key]: value });
    };

    const handleAddTag = () => {
        if (newTag.trim() && !localProps.tags?.includes(newTag.trim())) {
            const updatedTags = [...(localProps.tags || []), newTag.trim()];
            handleChange('tags', updatedTags);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const updatedTags = (localProps.tags || []).filter(t => t !== tagToRemove);
        handleChange('tags', updatedTags);
    };

    const content = {
        en: {
            title: 'Runbook settings',
            name: 'Name',
            namePlaceholder: 'My runbook',
            description: 'Description',
            descriptionPlaceholder: 'Describe what this runbook does...',
            active: 'Active',
            activeDescription: 'Enable or disable this runbook',
            schedule: 'Schedule (Cron)',
            schedulePlaceholder: '0 * * * * (every hour)',
            scheduleDescription: 'Cron expression for scheduled execution',
            tags: 'Tags',
            tagsPlaceholder: 'Add tag...',
            errorHandling: 'Error Handling',
            errorStop: 'Stop on Error',
            errorContinue: 'Continue on Error',
            errorRetry: 'Retry on Error',
            timeout: 'Timeout (ms)',
            timeoutDescription: 'Maximum execution time',
            retryCount: 'Retry Count',
            retryDelay: 'Retry Delay (ms)',
            save: 'Save Changes',
            close: 'Close',
        },
        es: {
            title: 'Configuración del runbook',
            name: 'Nombre',
            namePlaceholder: 'Mi runbook',
            description: 'Descripción',
            descriptionPlaceholder: 'Describe qué hace este runbook...',
            active: 'Activo',
            activeDescription: 'Activar o desactivar este runbook',
            schedule: 'Programación (Cron)',
            schedulePlaceholder: '0 * * * * (cada hora)',
            scheduleDescription: 'Expresión cron para ejecución programada',
            tags: 'Etiquetas',
            tagsPlaceholder: 'Agregar etiqueta...',
            errorHandling: 'Manejo de Errores',
            errorStop: 'Detener en Error',
            errorContinue: 'Continuar en Error',
            errorRetry: 'Reintentar en Error',
            timeout: 'Tiempo Límite (ms)',
            timeoutDescription: 'Tiempo máximo de ejecución',
            retryCount: 'Intentos de Reintento',
            retryDelay: 'Retraso de Reintento (ms)',
            save: 'Guardar Cambios',
            close: 'Cerrar',
        }
    };

    const text = content[lang] || content['en'];

    const inputClass = "w-full bg-black/20 border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors";
    const labelClass = "block text-[10px] font-bold uppercase text-slate-500 mb-1";

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="absolute right-0 top-0 bottom-0 w-96 shadow-2xl z-40 flex flex-col border-l border-slate-700"
                    initial={{ x: '100%', opacity: 1 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                    style={{
                        background: 'var(--box-background-color)',
                        borderLeft: '1px solid var(--border-color)',
                    }}
                    onWheel={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 h-12 border-b border-slate-700 bg-slate-800/50">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                            <FileText size={16} />
                            {text.title}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
                        {/* Runbook name */}
                        <div>
                            <label className={labelClass}>{text.name}</label>
                            <input
                                type="text"
                                value={localProps.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder={text.namePlaceholder}
                                className={inputClass}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className={labelClass}>{text.description}</label>
                            <textarea
                                value={localProps.description || ''}
                                onChange={(e) => handleChange('description', e.target.value)}
                                placeholder={text.descriptionPlaceholder}
                                rows={3}
                                className={`${inputClass} resize-none`}
                            />
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                            <div>
                                <div className="text-sm text-slate-200 font-medium">{text.active}</div>
                                <div className="text-xs text-slate-500">{text.activeDescription}</div>
                            </div>
                            <button
                                onClick={() => handleChange('isActive', !localProps.isActive)}
                                className={`p-2 rounded-lg transition-colors ${
                                    localProps.isActive
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-slate-700 text-slate-400'
                                }`}
                            >
                                {localProps.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </button>
                        </div>

                        {/* Schedule */}
                        <CronPicker
                            lang={lang}
                            value={localProps.schedule}
                            onChange={(next) => handleChange('schedule', next)}
                        />

                        {/* Triggers */}
                        <TriggersPanel lang={lang} workflowId={localProps.id} />

                        {/* Tags */}
                        <div>
                            <label className={labelClass}>
                                <Tag size={12} className="inline mr-1" />
                                {text.tags}
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(localProps.tags || []).map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full"
                                    >
                                        {tag}
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="hover:text-red-400 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                    placeholder={text.tagsPlaceholder}
                                    className={`${inputClass} flex-1`}
                                />
                                <button
                                    onClick={handleAddTag}
                                    className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors text-sm"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-slate-700" />

                        {/* Error Handling */}
                        <div>
                            <label className={labelClass}>{text.errorHandling}</label>
                            <select
                                value={localProps.errorHandling || 'stop'}
                                onChange={(e) => handleChange('errorHandling', e.target.value)}
                                className={inputClass}
                            >
                                <option value="stop">{text.errorStop}</option>
                                <option value="continue">{text.errorContinue}</option>
                                <option value="retry">{text.errorRetry}</option>
                            </select>
                        </div>

                        {/* Timeout */}
                        <div>
                            <label className={labelClass}>{text.timeout}</label>
                            <input
                                type="number"
                                value={localProps.timeout || 30000}
                                onChange={(e) => handleChange('timeout', parseInt(e.target.value) || 30000)}
                                className={`${inputClass} font-mono`}
                                min={1000}
                                step={1000}
                            />
                            <p className="text-[10px] text-slate-500 mt-1">{text.timeoutDescription}</p>
                        </div>

                        {/* Retry Settings (shown when errorHandling is 'retry') */}
                        {localProps.errorHandling === 'retry' && (
                            <div className="space-y-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                                <div>
                                    <label className={labelClass}>{text.retryCount}</label>
                                    <input
                                        type="number"
                                        value={localProps.retryCount || 3}
                                        onChange={(e) => handleChange('retryCount', parseInt(e.target.value) || 3)}
                                        className={`${inputClass} font-mono`}
                                        min={1}
                                        max={10}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>{text.retryDelay}</label>
                                    <input
                                        type="number"
                                        value={localProps.retryDelay || 1000}
                                        onChange={(e) => handleChange('retryDelay', parseInt(e.target.value) || 1000)}
                                        className={`${inputClass} font-mono`}
                                        min={100}
                                        step={100}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {onSave && (
                        <div className="p-4 border-t border-slate-700 bg-slate-800/30">
                            <button
                                onClick={onSave}
                                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Save size={16} />
                                {text.save}
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
