'use client';

import React, { useMemo } from 'react';
import { Sparkles, Zap, Brain, MessageSquare, Mail, Filter, GitBranch, Terminal, Plus } from 'lucide-react';
import type { WorkflowNode } from '@nanoflow/shared';
import type { SolderState } from '../../hooks/useEditorSoldering';
import type { ViewportState } from '../../types/editor.types';
import type { AISuggestion } from '../../hooks/useAI';

interface ContextualSuggestionsProps {
    soldering: SolderState;
    nodes: WorkflowNode[];
    viewport: ViewportState;
    onSelectSuggestion: (nodeType: string) => void;
    lang: 'en' | 'es';
    aiSuggestions?: AISuggestion[];
}

const SUGGESTIONS_MAP: Record<string, { type: string; icon: any; labelEn: string; labelEs: string }[]> = {
    'trigger.webhook': [
        { type: 'logic.filter', icon: Filter, labelEn: 'Filter Data', labelEs: 'Filtrar Datos' },
        { type: 'ai.text-generator', icon: Brain, labelEn: 'AI Process', labelEs: 'Procesar con IA' },
        { type: 'action.slack', icon: MessageSquare, labelEn: 'Send Slack', labelEs: 'Enviar Slack' },
    ],
    'ai.text-generator': [
        { type: 'logic.switch', icon: GitBranch, labelEn: 'Condition', labelEs: 'Condición' },
        { type: 'action.email-send', icon: Mail, labelEn: 'Send Email', labelEs: 'Enviar Email' },
        { type: 'action.slack', icon: MessageSquare, labelEn: 'Slack Result', labelEs: 'Slack Resultado' },
    ],
    'logic.filter': [
        { type: 'ai.text-generator', icon: Brain, labelEn: 'AI Analyze', labelEs: 'Analizar con IA' },
        { type: 'action.webhook', icon: Zap, labelEn: 'HTTP Request', labelEs: 'Petición HTTP' },
    ],
    'trigger.schedule': [
        { type: 'action.weather', icon: Zap, labelEn: 'Check Weather', labelEs: 'Clima' },
        { type: 'action.email-send', icon: Mail, labelEn: 'Morning Report', labelEs: 'Reporte Diario' },
    ]
};

const DEFAULT_SUGGESTIONS = [
    { type: 'ai.text-generator', icon: Brain, labelEn: 'AI Assistant', labelEs: 'Asistente IA' },
    { type: 'logic.filter', icon: Filter, labelEn: 'Filter', labelEs: 'Filtro' },
    { type: 'action.slack', icon: MessageSquare, labelEn: 'Slack', labelEs: 'Slack' },
];

const ICON_MAP: Record<string, any> = {
    'logic.filter': Filter,
    'ai.text-generator': Brain,
    'action.slack': MessageSquare,
    'action.email-send': Mail,
    'logic.switch': GitBranch,
    'action.webhook': Zap,
    'logic.code': Terminal,
    'n8n-nodes-base.httpRequest': Zap,
    'n8n-nodes-base.if': Filter,
    'n8n-nodes-base.code': Terminal,
};

export default function ContextualSuggestions({
    soldering,
    nodes,
    viewport,
    onSelectSuggestion,
    lang,
    aiSuggestions = []
}: ContextualSuggestionsProps) {
    const { mousePos } = soldering;
    
    const startNode = nodes.find(n => n.id === soldering.startNodeId);
    
    const mergedSuggestions = useMemo(() => {
        const baseSuggestions = (() => {
            if (!startNode) return DEFAULT_SUGGESTIONS;
            const type = startNode.type || '';
            const key = Object.keys(SUGGESTIONS_MAP).find(k => type.includes(k)) || 'default';
            return SUGGESTIONS_MAP[key] || DEFAULT_SUGGESTIONS;
        })();

        const aiFormatted = aiSuggestions.map(ai => ({
            type: ai.nodeType,
            icon: ICON_MAP[ai.nodeType] || ICON_MAP[ai.nodeType.split('.').pop() || ''] || Plus,
            labelEn: ai.nodeType.split('.').pop() || ai.nodeType,
            labelEs: ai.nodeType.split('.').pop() || ai.nodeType,
            isAI: true,
            reason: ai.reason
        }));

        // Limit to total 5 suggestions, prioritizing AI ones if they are not duplicates
        const seenTypes = new Set(aiFormatted.map(s => s.type));
        const filteredBase = baseSuggestions.filter(s => !seenTypes.has(s.type));
        
        return [...aiFormatted, ...filteredBase].slice(0, 5);
    }, [startNode, aiSuggestions]);

    // Only show if dragging from an output
    if (soldering.startPort !== 'output' && soldering.startPort !== 'down') return null;

    return (
        <div
            className="absolute z-[1001] pointer-events-none"
            style={{
                left: mousePos.x + 20,
                top: mousePos.y - 40,
            }}
        >
            <div className="flex flex-col gap-2 p-2 bg-slate-900/95 backdrop-blur-md border border-blue-500/30 rounded-xl shadow-2xl animate-in fade-in slide-in-from-left-2 duration-300 pointer-events-auto min-w-[180px]">
                <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 mb-1">
                    <div className="flex items-center gap-2">
                        <Sparkles size={12} className="text-blue-400 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {lang === 'en' ? 'Contextual' : 'Contextual'}
                        </span>
                    </div>
                    {aiSuggestions.length > 0 && (
                        <div className="bg-blue-500/20 text-blue-400 text-[8px] px-1.5 py-0.5 rounded-full font-bold">AI</div>
                    )}
                </div>
                
                <div className="flex flex-col gap-1">
                    {mergedSuggestions.map((suggestion, idx) => (
                        <button
                            key={`${suggestion.type}-${idx}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectSuggestion(suggestion.type);
                            }}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-600/20 hover:text-blue-400 transition-all text-slate-300 text-sm group text-left"
                            title={(suggestion as any).reason}
                        >
                            <suggestion.icon size={16} className={`${(suggestion as any).isAI ? 'text-blue-400' : 'text-slate-500'} group-hover:text-blue-400 transition-colors`} />
                            <div className="flex flex-col">
                                <span className="font-medium whitespace-nowrap">
                                    {lang === 'en' ? suggestion.labelEn : suggestion.labelEs}
                                </span>
                                {(suggestion as any).isAI && (
                                    <span className="text-[9px] text-slate-500 truncate max-w-[120px]">
                                        {(suggestion as any).reason}
                                    </span>
                                )}
                            </div>
                            <Zap size={10} className="ml-auto opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
