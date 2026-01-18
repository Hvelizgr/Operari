'use client';

import { Download, Moon, Sun, Plus, Upload, FileText, Zap, Play, Bug, Wand2, Loader2, CheckCircle2, AlertCircle, LayoutTemplate, ChevronDown, Wrench, BarChart3, Square, Settings2, Target, Gauge, ShieldAlert, ShieldCheck, FileWarning, FileCheck, Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';
import type { SaveStatus } from '../../hooks/useAutosave';

type BlastRadiusMode = 'off' | 'downstream' | 'upstream' | 'both';

interface TopBarProps {
    lang: 'en' | 'es';
    workflowName: string;
    onRun: () => void;
    onRunWithInput?: () => void;
    onDebug?: () => void;
    isExecuting?: boolean;
    onStop?: () => void;
    onResume?: () => void;
    executionStatus?: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | null;
    onProperties?: () => void;
    onExport?: () => void;
    onImport?: (file: File) => void;
    onAddNode?: () => void;
    onAutoLayout?: () => void;
    saveStatus?: SaveStatus;
    onTemplates?: () => void;
    onMetrics?: () => void;
    onPublish?: () => void;
    // Blast Radius (Impact Analysis)
    blastRadiusMode?: BlastRadiusMode;
    onToggleBlastRadius?: () => void;
    // Complexity Score
    complexityScore?: number;
    complexityLevel?: 'low' | 'medium' | 'high' | 'critical';
    // Security Scanner
    securityIssueCount?: number;
    securitySeverity?: 'low' | 'medium' | 'high' | 'critical' | null;
    // Architecture Linter
    lintErrorCount?: number;
    lintWarningCount?: number;
    lintPassed?: boolean;
    // Execution Heatmap
    heatmapEnabled?: boolean;
    onToggleHeatmap?: () => void;
}

export default function TopBar({
    lang,
    workflowName,
    onRun,
    onRunWithInput,
    onDebug,
    isExecuting,
    onStop,
    onResume,
    executionStatus,
    onProperties,
    onExport,
    onImport,
    onAddNode,
    onAutoLayout,
    saveStatus,
    onTemplates,
    onMetrics,
    onPublish,
    blastRadiusMode = 'off',
    onToggleBlastRadius,
    complexityScore,
    complexityLevel,
    securityIssueCount = 0,
    securitySeverity,
    lintErrorCount = 0,
    lintWarningCount = 0,
    lintPassed = true,
    heatmapEnabled = false,
    onToggleHeatmap,
}: TopBarProps) {
    const { highContrast, toggleHighContrast } = useAccessibility();
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

    const renderExecutionButton = () => {
        if (executionStatus === 'PAUSED') {
            return (
                <button
                    onClick={onResume}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-pulse"
                    title={lang === 'en' ? 'Resume Execution' : 'Reanudar Ejecución'}
                >
                    <Play size={14} fill="currentColor" />
                    <span>{lang === 'en' ? 'Resume' : 'Reanudar'}</span>
                </button>
            );
        }

        if (isExecuting) {
            return (
                <button
                    onClick={onStop}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
                    title={lang === 'en' ? 'Stop Execution' : 'Detener Ejecución'}
                >
                    <Square size={14} fill="currentColor" />
                    <span>{lang === 'en' ? 'Stop' : 'Detener'}</span>
                </button>
            );
        }

        return (
            <button
                onClick={onRun}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                title={lang === 'en' ? 'Run Workflow (Ctrl+Enter)' : 'Ejecutar Flujo (Ctrl+Enter)'}
            >
                <Zap size={16} />
                <span>{lang === 'en' ? 'Run' : 'Ejecutar'}</span>
            </button>
        );
    };

    return (
        <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-40 relative">
            {/* Left: Branding & Workflow Info */}
            <div className="flex items-center gap-4">
                <div className="font-bold text-xl bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                    NanoFlow
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
                {complexityScore !== undefined && complexityLevel && (
                    <>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                        <div
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                complexityLevel === 'low' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                complexityLevel === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' :
                                complexityLevel === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' :
                                'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                            }`}
                            title={lang === 'en' ? `Complexity Score: ${complexityScore}` : `Puntuación de Complejidad: ${complexityScore}`}
                        >
                            <Gauge size={12} />
                            <span>{complexityScore}</span>
                        </div>
                    </>
                )}
                {/* Security Badge */}
                <>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                    {securityIssueCount === 0 ? (
                        <div
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                            title={lang === 'en' ? 'No security issues detected' : 'No se detectaron problemas de seguridad'}
                        >
                            <ShieldCheck size={12} />
                            <span>{lang === 'en' ? 'Secure' : 'Seguro'}</span>
                        </div>
                    ) : (
                        <div
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                securitySeverity === 'critical' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                securitySeverity === 'high' ? 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                securitySeverity === 'medium' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' :
                                'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
                            }`}
                            title={lang === 'en' ? `${securityIssueCount} security issue(s) detected` : `${securityIssueCount} problema(s) de seguridad detectado(s)`}
                        >
                            <ShieldAlert size={12} />
                            <span>{securityIssueCount}</span>
                        </div>
                    )}
                </>
                {/* Lint Badge */}
                <>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                    {lintPassed && lintWarningCount === 0 ? (
                        <div
                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                            title={lang === 'en' ? 'No lint issues' : 'Sin problemas de lint'}
                        >
                            <FileCheck size={12} />
                            <span>{lang === 'en' ? 'Valid' : 'Válido'}</span>
                        </div>
                    ) : (
                        <div
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                lintErrorCount > 0
                                    ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                                    : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
                            }`}
                            title={lang === 'en' ? `${lintErrorCount} error(s), ${lintWarningCount} warning(s)` : `${lintErrorCount} error(es), ${lintWarningCount} advertencia(s)`}
                        >
                            <FileWarning size={12} />
                            <span>{lintErrorCount + lintWarningCount}</span>
                        </div>
                    )}
                </>
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

                            {/* Impact Analysis (Blast Radius) */}
                            {onToggleBlastRadius && (
                                <button
                                    onClick={() => { onToggleBlastRadius(); setIsToolsMenuOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                        blastRadiusMode !== 'off'
                                            ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <Target size={16} />
                                    {lang === 'en' ? 'Impact Analysis' : 'Análisis de Impacto'}
                                    <span className="ml-auto text-xs text-slate-400">
                                        {blastRadiusMode === 'off' ? 'Off' :
                                         blastRadiusMode === 'downstream' ? '↓' :
                                         blastRadiusMode === 'upstream' ? '↑' : '↕'}
                                    </span>
                                </button>
                            )}

                            {/* Execution Heatmap */}
                            {onToggleHeatmap && (
                                <button
                                    onClick={() => { onToggleHeatmap(); setIsToolsMenuOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                        heatmapEnabled
                                            ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <BarChart3 size={16} />
                                    {lang === 'en' ? 'Execution Heatmap' : 'Mapa de Calor'}
                                    <span className="ml-auto text-xs text-slate-400">
                                        {heatmapEnabled ? 'On' : 'Off'}
                                    </span>
                                </button>
                            )}

                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                            {/* Run with Input */}
                            {onRunWithInput && (
                                <button
                                    onClick={() => { onRunWithInput(); setIsToolsMenuOpen(false); }}
                                    disabled={isExecuting}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                >
                                    <Settings2 size={16} />
                                    {lang === 'en' ? 'Run with Input...' : 'Ejecutar con valores...'}
                                </button>
                            )}

                            {/* Debug */}
                            {onDebug && (
                                <button
                                    onClick={() => { onDebug(); setIsToolsMenuOpen(false); }}
                                    disabled={isExecuting}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
                                >
                                    <Bug size={16} />
                                    {lang === 'en' ? 'Debug Workflow' : 'Depurar Flujo'}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {renderExecutionButton()}
            </div>

            {/* Right: Secondary Actions */}
            <div className="flex items-center gap-1">
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

                {/* Publish to Marketplace */}
                {onPublish && (
                    <button
                        onClick={onPublish}
                        className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title={lang === 'en' ? 'Publish to Marketplace' : 'Publicar en Marketplace'}
                    >
                        <Globe size={18} />
                    </button>
                )}

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* Theme Toggle */}
                <button
                    onClick={toggleHighContrast}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title={lang === 'en' ? 'Toggle Theme' : 'Cambiar Tema'}
                >
                    {highContrast ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* User Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 ml-2 cursor-pointer ring-2 ring-white dark:ring-slate-900" />
            </div>
        </div>
    );
}
