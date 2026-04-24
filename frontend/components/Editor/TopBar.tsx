'use client';

import {
  AlertCircle,
  BarChart3,
  Bug,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Code2,
  Download,
  FileText,
  GitBranch,
  Grid3x3,
  LayoutTemplate,
  Loader2,
  Moon,
  MoonStar,
  Plus,
  Sparkles,
  Sun,
  Upload,
  Wand2,
  Wrench,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useTheme } from '../../context/ThemeContext';
import type { SaveStatus } from '../../hooks/useAutosave';

interface TopBarProps {
  lang: 'en' | 'es';
  workflowName: string;
  onRun: () => void;
  onDebug?: () => void;
  onDryRun?: () => void;
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
  onGitHub?: () => void;
  /** Opens the Schedule dialog. When set, a clock icon button surfaces
   *  in the TopBar — matches the prominence of Run/Debug instead of
   *  being buried inside the Properties panel (UX-audit #18). */
  onSchedule?: () => void;
  /** Current cron string (null/empty = unscheduled). When present,
   *  the Schedule button renders a small green dot so the operator
   *  sees at a glance that the runbook is on a timer. */
  scheduleExpr?: string | null;
}

export default function TopBar({
  lang,
  workflowName,
  onRun,
  onDebug,
  onDryRun,
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
  onGitHub,
  onSchedule,
  scheduleExpr,
}: TopBarProps) {
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
      saving: {
        icon: Loader2,
        text: lang === 'en' ? 'Saving...' : 'Guardando...',
        color: 'text-primary',
      },
      saved: {
        icon: CheckCircle2,
        text: lang === 'en' ? 'Saved' : 'Guardado',
        color: 'text-green-500',
      },
      error: { icon: AlertCircle, text: lang === 'en' ? 'Error' : 'Error', color: 'text-red-500' },
      conflict: {
        icon: AlertCircle,
        text: lang === 'en' ? 'Conflict' : 'Conflicto',
        color: 'text-primary',
      },
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
    <div className="relative z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
      {/* Left: Branding & Runbook info */}
      <div className="flex items-center gap-4">
        <div className="from-primary to-primary bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent">
          NanoRun
        </div>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="cursor-pointer rounded px-2 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            {workflowName}
          </span>
          <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
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
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
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
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title={lang === 'en' ? 'Tools' : 'Herramientas'}
          >
            <Wrench size={16} />
            <span className="hidden sm:inline">{lang === 'en' ? 'Tools' : 'Herramientas'}</span>
            <ChevronDown
              size={14}
              className={`transition-transform ${isToolsMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isToolsMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {/* Add Node */}
              <button
                onClick={() => {
                  onAddNode?.();
                  setIsToolsMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Plus size={16} />
                {lang === 'en' ? 'Add Node' : 'Agregar Nodo'}
                <span className="ml-auto text-xs text-slate-400">Space</span>
              </button>

              {/* Auto Layout */}
              <button
                onClick={() => {
                  onAutoLayout?.();
                  setIsToolsMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Wand2 size={16} />
                {lang === 'en' ? 'Auto Layout' : 'Organizar'}
              </button>

              <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />

              {/* Debug */}
              {onDebug && (
                <button
                  onClick={() => {
                    onDebug();
                    setIsToolsMenuOpen(false);
                  }}
                  disabled={isExecuting}
                  className="text-primary hover:bg-primary/10 dark:hover:bg-primary/90/20 flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors disabled:opacity-50"
                >
                  <Bug size={16} />
                  {lang === 'en' ? 'Debug runbook' : 'Depurar runbook'}
                </button>
              )}

              {/* Dry run — prints every step's intent without touching anything */}
              {onDryRun && (
                <button
                  onClick={() => {
                    onDryRun();
                    setIsToolsMenuOpen(false);
                  }}
                  disabled={isExecuting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-500 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                  title={
                    lang === 'en'
                      ? 'Run without executing any side effect'
                      : 'Correr sin ejecutar ningún side effect'
                  }
                >
                  <Wand2 size={16} />
                  {lang === 'en' ? 'Dry run' : 'Dry run'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Run - Always visible */}
        <button
          onClick={onRun}
          disabled={isExecuting}
          className="bg-primary hover:bg-primary flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors disabled:opacity-50"
          title={lang === 'en' ? 'Run runbook (Ctrl+Enter)' : 'Ejecutar runbook (Ctrl+Enter)'}
        >
          <Zap size={16} className={isExecuting ? 'animate-pulse' : ''} />
          <span>
            {isExecuting
              ? lang === 'en'
                ? 'Running...'
                : 'Ejecutando...'
              : lang === 'en'
                ? 'Run'
                : 'Ejecutar'}
          </span>
        </button>
      </div>

      {/* Right: Secondary Actions */}
      <div className="flex items-center gap-1">
        {/* AI assist */}
        {onAssist && (
          <button
            onClick={onAssist}
            className={`relative rounded-lg p-2 transition-colors ${
              hasFailedNode
                ? 'text-primary hover:bg-primary/10 animate-pulse'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
            title={lang === 'en' ? 'AI assist' : 'Asistente IA'}
          >
            <Sparkles size={18} />
            {hasFailedNode && (
              <span className="bg-primary absolute right-1 top-1 h-2 w-2 rounded-full" />
            )}
          </button>
        )}

        {/* YAML view */}
        {onYaml && (
          <button
            onClick={onYaml}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            title={lang === 'en' ? 'View as YAML' : 'Ver como YAML'}
          >
            <Code2 size={18} />
          </button>
        )}

        {/* GitHub Branches */}
        {onGitHub && (
          <button
            onClick={onGitHub}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            title={lang === 'en' ? 'GitHub Branches' : 'Ramas de GitHub'}
          >
            <GitBranch size={18} />
          </button>
        )}

        {/* Metrics */}
        {onMetrics && (
          <button
            onClick={onMetrics}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            title={lang === 'en' ? 'Metrics' : 'Métricas'}
          >
            <BarChart3 size={18} />
          </button>
        )}

        {/* Schedule — promoted from the Properties panel so operators
            see at a glance whether the runbook is on a cron. Green dot
            badge when scheduleExpr is set. */}
        {onSchedule && (
          <button
            onClick={onSchedule}
            aria-label={lang === 'en' ? 'Schedule' : 'Programar'}
            className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            title={
              scheduleExpr
                ? `${lang === 'en' ? 'Scheduled' : 'Programado'}: ${scheduleExpr}`
                : lang === 'en'
                  ? 'Schedule'
                  : 'Programar'
            }
          >
            <CalendarClock size={18} />
            {scheduleExpr && (
              <span
                aria-hidden="true"
                className="bg-primary border-background absolute right-1 top-1 h-2 w-2 rounded-full border"
              />
            )}
          </button>
        )}

        {/* Properties */}
        <button
          onClick={onProperties}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          title={lang === 'en' ? 'Properties' : 'Propiedades'}
        >
          <FileText size={18} />
        </button>

        {/* Import */}
        <label
          className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          title={lang === 'en' ? 'Import' : 'Importar'}
        >
          <Upload size={18} />
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file && onImport) onImport(file);
              e.target.value = '';
            }}
          />
        </label>

        {/* Export */}
        <button
          onClick={onExport}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          title={lang === 'en' ? 'Export' : 'Exportar'}
        >
          <Download size={18} />
        </button>

        <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Snap-to-grid toggle */}
        <button
          onClick={onToggleSnapToGrid}
          className={`rounded-lg p-2 transition-colors ${
            snapToGrid
              ? 'text-primary bg-primary/10 hover:bg-primary/20'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white'
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
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
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
        <div className="from-primary ml-2 h-8 w-8 cursor-pointer rounded-full bg-gradient-to-tr to-pink-500 ring-2 ring-white dark:ring-slate-900" />
      </div>
    </div>
  );
}
