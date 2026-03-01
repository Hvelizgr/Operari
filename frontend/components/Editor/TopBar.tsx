'use client';

import { Download, Moon, Sun, Plus, Upload, FileText, Zap, Play, Bug, Wand2, Loader2, CheckCircle2, AlertCircle, LayoutTemplate, ChevronDown, Wrench, BarChart3, Square, Settings2, Target, Gauge, ShieldAlert, ShieldCheck, FileWarning, FileCheck, Globe, ArrowDownToLine, ArrowUpFromLine, Clock, BrainCircuit } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';
import type { SaveStatus } from '../../hooks/useAutosave';

type BlastRadiusMode = 'off' | 'downstream' | 'upstream' | 'both';

interface TopBarProps {
    lang: 'en' | 'es';
    workflowName: string;
    onWorkflowNameChange?: (name: string) => void;
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
    onShare?: () => void;
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
    // n8n Integration
    onN8nImport?: () => void;
    onUniversalImport?: () => void;
    onN8nExport?: () => void;
    // AI Intelligence
    onGenerateDocs?: () => void;
    onRunAIAnalysis?: () => void;
    isAILoading?: boolean;
    // Approval System
    requiresApproval?: boolean;
    hasPendingApproval?: boolean;
    onStatusClick?: () => void;
}

export default function TopBar({
    lang,
    workflowName,
    onWorkflowNameChange,
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
    onShare,
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
    onN8nImport,
    onUniversalImport,
    onN8nExport,
    onGenerateDocs,
    onRunAIAnalysis,
    isAILoading = false,
    requiresApproval = false,
    hasPendingApproval = false,
    onStatusClick,
}: TopBarProps) {
    const { highContrast, toggleHighContrast } = useAccessibility();
    const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(workflowName);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const toolsMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setEditedName(workflowName);
    }, [workflowName]);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const handleNameSubmit = () => {
        const trimmedName = editedName.trim();
        if (trimmedName && trimmedName !== workflowName) {
            onWorkflowNameChange?.(trimmedName);
        } else {
            setEditedName(workflowName);
        }
        setIsEditingName(false);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameSubmit();
        } else if (e.key === 'Escape') {
            setEditedName(workflowName);
            setIsEditingName(false);
        }
    };

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
            retrying: { icon: Loader2, text: lang === 'en' ? 'Retrying...' : 'Reintentando...', color: 'text-yellow-500' },
        }[saveStatus];
        if (!config) return null;
        const Icon = config.icon;
        return (
            <span className={`flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
                <Icon size={14} className={saveStatus === 'saving' || saveStatus === 'retrying' ? 'animate-spin' : ''} />
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
                id="run-workflow-btn"
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
        <div className="h-16 bg-[#09090b] border-b border-white/5 flex items-center justify-between px-6 z-40 relative backdrop-blur-xl">
            {/* Left: Branding & Workflow Info */}
            <div className="flex items-center gap-6">
                <div className="font-bold text-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent flex items-center gap-2">
                    <Zap size={20} className="text-blue-500 fill-blue-500/50" />
                    NanoFlow
                </div>
                <div className="h-8 w-px bg-white/5" />
                <div className="flex items-center gap-3">
                    {isEditingName ? (
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            onBlur={handleNameSubmit}
                            onKeyDown={handleNameKeyDown}
                            className="text-sm font-medium text-gray-200 bg-white/10 px-3 py-1.5 rounded-lg border border-blue-500 outline-none focus:ring-2 focus:ring-blue-500/50 min-w-[150px]"
                            placeholder={lang === 'en' ? 'Workflow name' : 'Nombre del flujo'}
                        />
                    ) : (
                        <span 
                            onClick={() => setIsEditingName(true)}
                            className="text-sm font-medium text-gray-200 hover:bg-white/5 px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-transparent hover:border-white/10"
                            title={lang === 'en' ? 'Click to rename' : 'Haz clic para renombrar'}
                        >
                            {workflowName}
                        </span>
                    )}
                    {hasPendingApproval ? (
                        <span 
                            onClick={onStatusClick}
                            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 font-bold border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)] animate-pulse cursor-pointer flex items-center gap-1"
                            title={lang === 'en' ? 'Pending Approval' : 'Pendiente de Aprobación'}
                        >
                            <Clock size={10} />
                            {lang === 'en' ? 'Pending' : 'Pendiente'}
                        </span>
                    ) : requiresApproval ? (
                        <span 
                            onClick={onStatusClick}
                            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)] cursor-pointer flex items-center gap-1"
                            title={lang === 'en' ? 'Requires Approval' : 'Requiere Aprobación'}
                        >
                            <ShieldAlert size={10} />
                            {lang === 'en' ? 'Regulated' : 'Regulado'}
                        </span>
                    ) : (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-bold border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                            {lang === 'en' ? 'Free' : 'Libre'}
                        </span>
                    )}
                </div>
                <div className="h-8 w-px bg-white/5" />
                {renderSaveStatus()}
                {/* Responsive Badges Container - Hidden on mobile, visible on desktop */}
                <div className="hidden lg:flex items-center gap-6">
                    {complexityScore !== undefined && complexityLevel && (
                        <>
                            <div className="h-8 w-px bg-white/5" />
                            <div
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                    complexityLevel === 'low' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                    complexityLevel === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                    complexityLevel === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                    'bg-red-500/10 text-red-500 border-red-500/20'
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
                        <div className="h-8 w-px bg-white/5" />
                        {securityIssueCount === 0 ? (
                            <div
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20"
                                title={lang === 'en' ? 'No security issues detected' : 'No se detectaron problemas de seguridad'}
                            >
                                <ShieldCheck size={12} />
                                <span>{lang === 'en' ? 'Secure' : 'Seguro'}</span>
                            </div>
                        ) : (
                            <div
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                    securitySeverity === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                    securitySeverity === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    securitySeverity === 'medium' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                    'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
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
                        <div className="h-8 w-px bg-white/5" />
                        {lintPassed && lintWarningCount === 0 ? (
                            <div
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20"
                                title={lang === 'en' ? 'No lint issues' : 'Sin problemas de lint'}
                            >
                                <FileCheck size={12} />
                                <span>{lang === 'en' ? 'Valid' : 'Válido'}</span>
                            </div>
                        ) : (
                            <div
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                    lintErrorCount > 0
                                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                }`}
                                title={lang === 'en' ? `${lintErrorCount} error(s), ${lintWarningCount} warning(s)` : `${lintErrorCount} error(es), ${lintWarningCount} advertencia(s)`}
                            >
                                <FileWarning size={12} />
                                <span>{lintErrorCount + lintWarningCount}</span>
                            </div>
                        )}
                    </>
                </div>
                {onTemplates && (
                    <>
                        <div className="h-8 w-px bg-white/5" />
                        <button
                            onClick={onTemplates}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/10"
                            title={lang === 'en' ? 'Templates' : 'Plantillas'}
                        >
                            <LayoutTemplate size={16} />
                            <span className="hidden sm:inline">{lang === 'en' ? 'Templates' : 'Plantillas'}</span>
                        </button>
                    </>
                )}
            </div>

            {/* Center: Primary Actions */}
            <div className="flex items-center gap-3">
                {/* Tools Dropdown */}
                <div className="relative" ref={toolsMenuRef}>
                    <button
                        id="tools-menu-btn"
                        onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all border ${
                            isToolsMenuOpen 
                                ? 'bg-white/10 text-white border-white/20' 
                                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                        }`}
                        title={lang === 'en' ? 'Tools' : 'Herramientas'}
                    >
                        <Wrench size={16} />
                        <span className="hidden sm:inline">{lang === 'en' ? 'Tools' : 'Herramientas'}</span>
                        <ChevronDown size={14} className={`transition-transform ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isToolsMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-[#09090b] border border-white/10 rounded-xl shadow-2xl z-50 py-1 overflow-hidden ring-1 ring-white/5">
                            {/* Add Node */}
                            <button
                                onClick={() => { onAddNode?.(); setIsToolsMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                <Plus size={16} className="text-blue-500" />
                                {lang === 'en' ? 'Add Node' : 'Agregar Nodo'}
                            </button>

                            {/* Auto Layout */}
                            <button
                                onClick={() => { onAutoLayout?.(); setIsToolsMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                <Wand2 size={16} className="text-purple-500" />
                                {lang === 'en' ? 'Auto Layout' : 'Organizar'}
                            </button>

                             <div className="h-px bg-white/5 my-1" />

                            {/* Impact Analysis (Blast Radius) */}
                            {onToggleBlastRadius && (
                                <button
                                    onClick={() => { onToggleBlastRadius(); setIsToolsMenuOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                        blastRadiusMode !== 'off'
                                            ? 'text-orange-400 bg-orange-500/10'
                                            : 'text-gray-300 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <Target size={16} />
                                    {lang === 'en' ? 'Impact Analysis' : 'Análisis de Impacto'}
                                    <span className="ml-auto text-xs text-gray-500">
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
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                        heatmapEnabled
                                            ? 'text-red-400 bg-red-500/10'
                                            : 'text-gray-300 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <BarChart3 size={16} />
                                    {lang === 'en' ? 'Execution Heatmap' : 'Mapa de Calor'}
                                    <span className="ml-auto text-xs text-gray-500">
                                        {heatmapEnabled ? 'On' : 'Off'}
                                    </span>
                                </button>
                            )}

                            <div className="h-px bg-white/5 my-1" />

                            {/* Run with Input */}
                            {onRunWithInput && (
                                <button
                                    onClick={() => { onRunWithInput(); setIsToolsMenuOpen(false); }}
                                    disabled={isExecuting}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                                >
                                    <Settings2 size={16} className="text-gray-400" />
                                    {lang === 'en' ? 'Run with Input...' : 'Ejecutar con valores...'}
                                </button>
                            )}

                            {/* Debug */}
                            {onDebug && (
                                <button
                                    onClick={() => { onDebug(); setIsToolsMenuOpen(false); }}
                                    disabled={isExecuting}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
                                >
                                    <Bug size={16} />
                                    {lang === 'en' ? 'Debug Workflow' : 'Depurar Flujo'}
                                </button>
                            )}

                            <div className="h-px bg-white/5 my-1" />

                            {/* AI Documentation */}
                            <button
                                onClick={() => { onGenerateDocs?.(); setIsToolsMenuOpen(false); }}
                                disabled={isAILoading}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                            >
                                {isAILoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                {lang === 'en' ? 'AI Documentation' : 'Documentación IA'}
                            </button>

                            {/* AI Analysis */}
                            <button
                                onClick={() => { onRunAIAnalysis?.(); setIsToolsMenuOpen(false); }}
                                disabled={isAILoading}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                            >
                                {isAILoading ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                                {lang === 'en' ? 'AI Risk Analysis' : 'Análisis de Riesgo IA'}
                            </button>

                            {/* n8n Integration Section */}
                            {(onN8nImport || onN8nExport) && (
                                <>
                                    <div className="h-px bg-white/5 my-1" />
                                    <div className="px-4 py-1.5">
                                        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-600">n8n</span>
                                    </div>
                                    {onN8nImport && (
                                        <button
                                            onClick={() => { onN8nImport(); setIsToolsMenuOpen(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                                        >
                                            <ArrowDownToLine size={16} className="text-orange-500" />
                                            {lang === 'en' ? 'Import from n8n' : 'Importar desde n8n'}
                                        </button>
                                    )}
                                    {onN8nExport && (
                                        <button
                                            onClick={() => { onN8nExport(); setIsToolsMenuOpen(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                                        >
                                            <ArrowUpFromLine size={16} className="text-green-500" />
                                            {lang === 'en' ? 'Export to n8n' : 'Exportar a n8n'}
                                        </button>
                                    )}

                                    {onUniversalImport && (
                                        <>
                                            <div className="h-px bg-white/5 my-1" />
                                            <div className="px-4 py-1.5">
                                                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-600">
                                                    {lang === 'en' ? 'External Import' : 'Importación Externa'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => { onUniversalImport(); setIsToolsMenuOpen(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                <Download size={16} className="text-blue-500" />
                                                {lang === 'en' ? 'Zapier / Make / n8n' : 'Zapier / Make / n8n'}
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {renderExecutionButton()}
            </div>

            {/* Right: Secondary Actions */}
            <div className="flex items-center gap-2">
                {/* Metrics */}
                {onMetrics && (
                    <button
                        onClick={onMetrics}
                        className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        title={lang === 'en' ? 'Metrics' : 'Métricas'}
                    >
                        <BarChart3 size={18} />
                    </button>
                )}

                {/* Properties */}
                <button
                    onClick={onProperties}
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    title={lang === 'en' ? 'Properties' : 'Propiedades'}
                >
                    <FileText size={18} />
                </button>

                {/* Import */}
                <label className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer" title={lang === 'en' ? 'Import' : 'Importar'}>
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
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    title={lang === 'en' ? 'Export' : 'Exportar'}
                >
                    <Download size={18} />
                </button>

                {/* Share/Permissions */}
                {onShare && (
                    <button
                        onClick={onShare}
                        className="p-2.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                        title={lang === 'en' ? 'Share & Permissions' : 'Compartir y Permisos'}
                    >
                        <ShieldCheck size={18} />
                    </button>
                )}

                {/* Publish to Marketplace */}
                {onPublish && (
                    <button
                        onClick={onPublish}
                        className="p-2.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all"
                        title={lang === 'en' ? 'Publish to Marketplace' : 'Publicar en Marketplace'}
                    >
                        <Globe size={18} />
                    </button>
                )}

                <div className="h-8 w-px bg-white/5 mx-2" />

                {/* Theme Toggle */}
                <button
                    onClick={toggleHighContrast}
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    title={lang === 'en' ? 'Toggle Theme' : 'Cambiar Tema'}
                >
                    {highContrast ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* User Avatar */}
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 ml-2 cursor-pointer shadow-lg shadow-purple-500/20 ring-1 ring-white/10" />
            </div>
        </div>
    );
}
