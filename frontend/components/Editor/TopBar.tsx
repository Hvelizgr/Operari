'use client';

import { Menu, Play, Save, Settings, ChevronLeft, ChevronRight, Share2, Download, Moon, Sun, Monitor, Search, Plus, X } from 'lucide-react';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useState } from 'react';

interface TopBarProps {
    lang: 'en' | 'es';
    workflowName: string;
    onRun: () => void;
    onSave?: () => void;
    isSaving?: boolean;
    isExecuting?: boolean;
}

export default function TopBar({ lang, workflowName, onRun, onSave, isSaving, isExecuting }: TopBarProps) {
    const { highContrast, toggleHighContrast } = useAccessibility();

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    return (
        <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-40 relative">
            {/* Left: Branding & Workflow Info OR Search */}
            <div className="flex items-center gap-4 flex-1">
                {isSearchOpen ? (
                    <div className="flex items-center gap-3 px-4 py-2 border rounded-md border-slate-200 dark:border-slate-700 w-full max-w-md animate-in fade-in slide-in-from-left-2 transition-all">
                        <Search size={18} className="text-slate-400" />
                        <input
                            autoFocus
                            type="text"
                            placeholder={lang === 'en' ? "Search nodes..." : "Buscar nodos..."}
                            className="flex-1 bg-transparent text-sm focus:outline-none text-slate-700 dark:text-white placeholder-slate-400"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                        />
                        <button onClick={() => { setIsSearchOpen(false); setSearchValue(''); }}>
                            <X size={16} className="text-slate-400 hover:text-slate-900 dark:hover:text-white" />
                        </button>
                    </div>
                ) : (
                    <>
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

                        <button
                            onClick={() => setIsSearchOpen(true)}
                            className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md text-sm font-medium transition-colors"
                        >
                            <Plus size={16} />
                            <span>{lang === 'en' ? 'Add Node' : 'Agregar Nodo'}</span>
                        </button>
                    </>
                )}
            </div>

            {/* Center: Quick Stats / Status (Optional) */}
            <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-500 dark:text-slate-400">
                {isSaving && (
                    <span className="flex items-center gap-1.5 animate-pulse text-blue-500">
                        <Save size={12} />
                        {lang === 'en' ? 'Saving...' : 'Guardando...'}
                    </span>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={toggleHighContrast}
                        className={`p-1.5 rounded-md transition-all ${highContrast
                            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        title={lang === 'en' ? 'Toggle Theme' : 'Cambiar Tema'}
                    >
                        {highContrast ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                <button
                    onClick={onRun}
                    disabled={isExecuting}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
                        ${isExecuting
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 active:scale-95'
                        }
                    `}
                >
                    <Play size={14} className={isExecuting ? 'animate-spin' : 'fill-current'} />
                    <span>{isExecuting ? 'Running...' : (lang === 'en' ? 'Run' : 'Ejecutar')}</span>
                </button>

                <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <Share2 size={18} />
                </button>
                <button className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <Settings size={18} />
                </button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 ml-2 cursor-pointer ring-2 ring-white dark:ring-slate-900" />
            </div>
        </div>
    );
}
