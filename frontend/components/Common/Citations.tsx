'use client';

import { useState } from 'react';
import { FileText, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

export interface Source {
    index: number;
    id: string;
    text: string;
    score: number;
    metadata?: Record<string, any>;
}

interface CitationsProps {
    sources: Source[];
    onSourceClick?: (source: Source) => void;
    className?: string;
    lang?: 'en' | 'es';
}

const content = {
    en: {
        sources: 'Sources',
        relevance: 'Relevance',
        showMore: 'Show more',
        showLess: 'Show less',
        noSources: 'No sources available'
    },
    es: {
        sources: 'Fuentes',
        relevance: 'Relevancia',
        showMore: 'Ver más',
        showLess: 'Ver menos',
        noSources: 'No hay fuentes disponibles'
    }
};

export function Citations({ sources, onSourceClick, className = '', lang = 'en' }: CitationsProps) {
    const [expanded, setExpanded] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const text = content[lang];

    if (!sources || sources.length === 0) {
        return null;
    }

    const displayedSources = expanded ? sources : sources.slice(0, 3);

    return (
        <div className={`mt-3 ${className}`}>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <FileText size={12} />
                <span>{text.sources} ({sources.length})</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
                {displayedSources.map((source) => (
                    <div
                        key={source.id}
                        className="relative"
                        onMouseEnter={() => setHoveredIndex(source.index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <button
                            onClick={() => onSourceClick?.(source)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800/50 hover:bg-slate-700/50 rounded text-xs text-slate-300 transition-colors border border-slate-700/50"
                        >
                            <span className="w-4 h-4 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded text-[10px] font-medium">
                                {source.index}
                            </span>
                            <span className="max-w-[100px] truncate">{source.metadata?.title || source.id}</span>
                            <span className="text-[10px] text-slate-500">{source.score}%</span>
                        </button>
                        
                        {hoveredIndex === source.index && (
                            <div className="absolute z-50 bottom-full left-0 mb-2 w-72 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
                                <div className="flex items-start justify-between mb-2">
                                    <span className="text-xs font-medium text-slate-200">
                                        {source.metadata?.title || `Source ${source.index}`}
                                    </span>
                                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                        {source.score}% {text.relevance}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    {source.text}
                                </p>
                                {source.metadata?.source && (
                                    <div className="mt-2 pt-2 border-t border-slate-700">
                                        <a 
                                            href={source.metadata.source} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                            <ExternalLink size={10} />
                                            {source.metadata.source}
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {sources.length > 3 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-2 text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
                >
                    {expanded ? (
                        <>
                            <ChevronUp size={12} />
                            {text.showLess}
                        </>
                    ) : (
                        <>
                            <ChevronDown size={12} />
                            {text.showMore} ({sources.length - 3})
                        </>
                    )}
                </button>
            )}
        </div>
    );
}

export function CitationInline({ index, onClick }: { index: number; onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center justify-center w-4 h-4 mx-0.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-[10px] font-medium transition-colors align-super"
        >
            {index}
        </button>
    );
}
