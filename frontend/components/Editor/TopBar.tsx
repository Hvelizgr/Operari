'use client';

import { Download, Moon, Sun, MoonStar, Plus, Upload, FileText, Zap, Bug, Wand2, Loader2, CheckCircle2, AlertCircle, LayoutTemplate, ChevronDown, Wrench, BarChart3, Code2, Sparkles, Grid3x3 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useTheme } from '../../context/ThemeContext';
import type { SaveStatus } from '../../hooks/useAutosave';

interface TopBarProps {
    lang: 'en' | 'es';
    workflowName: string;
    onRun: () => void;
    onDebug?: () => void;
    isExecuting?: boolean;
    onProperties?: () => void;
    onExport?: () => void;
    onImport?: (file: File) => void;
    onAddNode?: () => void;
    onAutoLayout?: () => void;
    saveStatus?: SaveStatus;
    onTemplates?: () => void;
    onMetrics?: () => void;
    onYaml?: () => void;
    onAssist?: () => void;
    hasFailedNode?: boolean;
    snapToGrid?: boolean;
    onToggleSnapToGrid?: () => void;
}

export default function TopBar({
    lang,
    workflowName,
    onRun,
    onDebug,
    isExecuting,
    onProperties,
    onExport,
    onImport,
    onAddNode,
    onAutoLayout,
    saveStatus,
    onTemplates,
    onMetrics,
    onYaml,
    onAssist,
    hasFailedNode,
    snapToGrid,
    onToggleSnapToGrid,
}: TopBarProps) {
    const { highContrast, toggleHighContrast } = useAccessibility();
    const { theme, cycleTheme } = useTheme();
    const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
    const toolsMenuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
                setIsToolsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const renderSaveStatus = () => {
        if (!saveStatus) return null;
        const config = {
            saving: { icon: Loader2, text: lang === 'en' ? 'Saving...' : 'Guardando...', color: 'text-blue-500' },
            saved: { icon: CheckCircle2, text: lang === 'en' ? 'Saved' : 'Guardado', color: 'text-green-500' },
            error: { icon: AlertCircle, text: lang === 'en' ? 'Error' : 'Error', color: 'text-red-500' },
            conflict: { icon: AlertCircle, text: lang === 'en' ? 'Conflict' : 'Conflicto', color: 'text-orange-500' },
        }[saveStatus];
        if (!config) return null;
        const Icon = config.icon;
        return (
            <span className={`flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
                <Icon size={14} className={saveStatus === 'saving' ? 'animate-spin' : ''} />
                {config.text}
            </span>
        );
    };

    return (
        <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-40 relative">
            {/* Left: Branding & Runbook info */}
            <div className="flex items-center gap-4">
                <div className="font-bold text-xl bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                    NanoRun
                </div>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors">
                        {workflowName}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium border border-green-200 dark:border-green-800">
                        Active
                    </span>
                </div>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                {renderSaveStatus()}
                {onTemplates && (
                    <>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                        <button
                            onClick={onTemplates}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title={lang === 'en' ? 'Templates' : 'Plantillas'}
                        >
                            <LayoutTemplate size={16} />
                            <span className="hidden sm:inline">{lang === 'en' ? 'Templates' : 'Plantillas'}</span>
                        </button>
                    </>
                )}
            </div>

            {/* Center: Primary Actions */}
            <div className="flex items-center gap-2">
                {/* Tools Dropdown */}
                <div className="relative" ref={toolsMenuRef}>
                    <button
                        onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title={lang === 'en' ? 'Tools' : 'Herramientas'}
                    >
                        <Wrench size={16} />
                        <span className="hidden sm:inline">{lang === 'en' ? 'Tools' : 'Herramientas'}</span>
                        <ChevronDown size={14} className={`transition-transform ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isToolsMenuOpen && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 py-1">
                            {/* Add Node */}
                            <button
                                onClick={() => { onAddNode?.(); setIsToolsMenuOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <Plus size={16} />
                                {lang === 'en' ? 'Add Node' : 'Agregar Nodo'}
                                <span className="ml-auto text-xs text-slate-400">Space</span>
                            </button>

                            {/* Auto Layout */}
                            <button
                                onClick={() => { onAutoLayout?.(); setIsToolsMenuOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <Wand2 size={16} />
                                {lang === 'en' ? 'Auto Layout' : 'Organizar'}
                            </button>

                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                            {/* Debug */}
                            {onDebug && (
                                <button
                                    onClick={() => { onDebug(); setIsToolsMenuOpen(false); }}
                                    disabled={isExecuting}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
                                >
                                    <Bug size={16} />
                                    {lang === 'en' ? 'Debug runbook' : 'Depurar runbook'}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Run - Always visible */}
                <button
                    onClick={onRun}
                    disabled={isExecuting}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                    title={lang === 'en' ? 'Run runbook (Ctrl+Enter)' : 'Ejecutar runbook (Ctrl+Enter)'}
                >
                    <Zap size={16} className={isExecuting ? 'animate-pulse' : ''} />
                    <span>{isExecuting ? (lang === 'en' ? 'Running...' : 'Ejecutando...') : (lang === 'en' ? 'Run' : 'Ejecutar')}</span>
                </button>
            </div>

            {/* Right: Secondary Actions */}
            <div className="flex items-center gap-1">
                {/* AI assist */}
                {onAssist && (
                    <button
                        onClick={onAssist}
                        className={`relative p-2 rounded-lg transition-colors ${
                            hasFailedNode
                                ? 'text-violet-500 hover:bg-violet-500/10 animate-pulse'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={lang === 'en' ? 'AI assist' : 'Asistente IA'}
                    >
                        <Sparkles size={18} />
                        {hasFailedNode && (
                            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-violet-500" />
                        )}
                    </button>
                )}

                {/* YAML view */}
                {onYaml && (
                    <button
                        onClick={onYaml}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title={lang === 'en' ? 'View as YAML' : 'Ver como YAML'}
                    >
                        <Code2 size={18} />
                    </button>
                )}

                {/* Metrics */}
                {onMetrics && (
                    <button
                        onClick={onMetrics}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title={lang === 'en' ? 'Metrics' : 'Métricas'}
                    >
                        <BarChart3 size={18} />
                    </button>
                )}

                {/* Properties */}
                <button
                    onClick={onProperties}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title={lang === 'en' ? 'Properties' : 'Propiedades'}
                >
                    <FileText size={18} />
                </button>

                {/* Import */}
                <label className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title={lang === 'en' ? 'Import' : 'Importar'}>
                    <Upload size={18} />
                    <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && onImport) onImport(file);
                            e.target.value = '';
                        }}
                    />
                </label>

                {/* Export */}
                <button
                    onClick={onExport}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title={lang === 'en' ? 'Export' : 'Exportar'}
                >
                    <Download size={18} />
                </button>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* Snap-to-grid toggle */}
                <button
                    onClick={onToggleSnapToGrid}
                    className={`p-2 rounded-lg transition-colors ${
                        snapToGrid
                            ? 'text-blue-500 bg-blue-500/10 hover:bg-blue-500/20'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={
                        lang === 'en'
                            ? snapToGrid
                                ? 'Snap to grid: ON'
                                : 'Snap to grid: OFF'
                            : snapToGrid
                              ? 'Snap a la grilla: ON'
                              : 'Snap a la grilla: OFF'
                    }
                >
                    <Grid3x3 size={18} />
                </button>

                {/* Theme cycle: light → dark → midnight */}
                <button
                    onClick={cycleTheme}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title={
                        lang === 'en'
                            ? `Theme: ${theme} (click to cycle)`
                            : `Tema: ${theme} (click para cambiar)`
                    }
                >
                    {theme === 'light' ? (
                        <Sun size={18} />
                    ) : theme === 'dark' ? (
                        <Moon size={18} />
                    ) : (
                        <MoonStar size={18} />
                    )}
                </button>

                {/* User Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 ml-2 cursor-pointer ring-2 ring-white dark:ring-slate-900" />
            </div>
        </div>
    );
}
