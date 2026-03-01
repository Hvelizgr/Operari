'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Github, Globe, Package, Star, Download, ExternalLink, Loader2, Filter } from 'lucide-react';

type NodeSource = 'github' | 'ncnodes' | 'npm';

interface CommunityNode {
    name: string;
    description: string;
    version: string;
    author: string;
    downloads?: number;
    stars?: number;
    keywords: string[];
    repository?: string;
    homepage?: string;
    source: NodeSource;
    category?: string;
    lastUpdated?: string;
}

interface SearchResult {
    nodes: CommunityNode[];
    sources: { github: number; ncnodes: number; npm: number };
    total: number;
}

interface CommunityNodesExplorerProps {
    apiUrl: string;
    lang?: 'en' | 'es';
    onInstall?: (node: CommunityNode) => void;
}

const sourceConfig: Record<NodeSource, { label: string; icon: typeof Github; color: string; bgColor: string }> = {
    github: { label: 'GitHub', icon: Github, color: 'text-white', bgColor: 'bg-slate-700' },
    ncnodes: { label: 'NCNodes', icon: Globe, color: 'text-cyan-400', bgColor: 'bg-cyan-900/50' },
    npm: { label: 'npm', icon: Package, color: 'text-red-400', bgColor: 'bg-red-900/50' },
};

const translations = {
    en: {
        title: 'Community Nodes',
        subtitle: 'Discover nodes created by the n8n community',
        searchPlaceholder: 'Search nodes...',
        filterAll: 'All Sources',
        noResults: 'No nodes found',
        install: 'Install',
        viewDetails: 'View Details',
        sources: 'Sources',
        loading: 'Loading...',
        error: 'Error loading nodes',
        retry: 'Retry',
    },
    es: {
        title: 'Nodos de la Comunidad',
        subtitle: 'Descubre nodos creados por la comunidad de n8n',
        searchPlaceholder: 'Buscar nodos...',
        filterAll: 'Todas las Fuentes',
        noResults: 'No se encontraron nodos',
        install: 'Instalar',
        viewDetails: 'Ver Detalles',
        sources: 'Fuentes',
        loading: 'Cargando...',
        error: 'Error al cargar nodos',
        retry: 'Reintentar',
    },
};

export function CommunityNodesExplorer({ apiUrl, lang = 'en', onInstall }: CommunityNodesExplorerProps) {
    const [nodes, setNodes] = useState<CommunityNode[]>([]);
    const [sources, setSources] = useState<SearchResult['sources']>({ github: 0, ncnodes: 0, npm: 0 });
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<NodeSource | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const t = translations[lang];

    const fetchNodes = useCallback(async (searchQuery?: string) => {
        setLoading(true);
        setError(null);
        
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('q', searchQuery);
            params.set('limit', '50');

            const response = await fetch(`${apiUrl}/api/community-nodes?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch');
            
            const data: SearchResult = await response.json();
            setNodes(data.nodes);
            setSources(data.sources);
        } catch {
            setError(t.error);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, t.error]);

    useEffect(() => {
        fetchNodes();
    }, [fetchNodes]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            if (query.length >= 2 || query.length === 0) {
                fetchNodes(query || undefined);
            }
        }, 300);
        return () => clearTimeout(debounce);
    }, [query, fetchNodes]);

    const filteredNodes = filter === 'all' 
        ? nodes 
        : nodes.filter(n => n.source === filter);

    return (
        <div className="w-full max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
                <p className="text-slate-400">{t.subtitle}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as NodeSource | 'all')}
                        className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">{t.filterAll}</option>
                        <option value="github">GitHub ({sources.github})</option>
                        <option value="ncnodes">NCNodes ({sources.ncnodes})</option>
                        <option value="npm">npm ({sources.npm})</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-4 mb-6 text-sm">
                <span className="text-slate-400">{t.sources}:</span>
                {Object.entries(sources).map(([source, count]) => {
                    const config = sourceConfig[source as NodeSource];
                    const Icon = config.icon;
                    return (
                        <div key={source} className={`flex items-center gap-1.5 px-2 py-1 rounded ${config.bgColor}`}>
                            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                            <span className={config.color}>{count}</span>
                        </div>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="ml-3 text-slate-400">{t.loading}</span>
                </div>
            ) : error ? (
                <div className="text-center py-20">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button
                        onClick={() => fetchNodes()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        {t.retry}
                    </button>
                </div>
            ) : filteredNodes.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-slate-400">{t.noResults}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredNodes.map((node, idx) => (
                        <NodeCard 
                            key={`${node.source}-${node.name}-${idx}`} 
                            node={node} 
                            lang={lang}
                            onInstall={onInstall}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function NodeCard({ 
    node, 
    lang,
    onInstall 
}: { 
    node: CommunityNode; 
    lang: 'en' | 'es';
    onInstall?: (node: CommunityNode) => void;
}) {
    const config = sourceConfig[node.source];
    const Icon = config.icon;
    const t = translations[lang];

    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-colors">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate" title={node.name}>
                        {node.name}
                    </h3>
                    <p className="text-xs text-slate-400">by {node.author}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.bgColor}`}>
                    <Icon className={`w-3 h-3 ${config.color}`} />
                    <span className={config.color}>{config.label}</span>
                </div>
            </div>

            <p className="text-sm text-slate-300 mb-3 line-clamp-2" title={node.description}>
                {node.description || 'No description available'}
            </p>

            {node.category && (
                <div className="mb-3">
                    <span className="inline-block px-2 py-0.5 bg-slate-700/50 text-slate-300 text-xs rounded">
                        {node.category}
                    </span>
                </div>
            )}

            <div className="flex items-center gap-4 mb-4 text-xs text-slate-400">
                {node.stars !== undefined && node.stars > 0 && (
                    <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-500" />
                        <span>{node.stars >= 1000 ? `${(node.stars / 1000).toFixed(1)}k` : node.stars}</span>
                    </div>
                )}
                {node.downloads !== undefined && node.downloads > 0 && (
                    <div className="flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" />
                        <span>{node.downloads >= 1000 ? `${(node.downloads / 1000).toFixed(1)}k` : node.downloads}</span>
                    </div>
                )}
                {node.version && node.version !== 'latest' && (
                    <span>v{node.version}</span>
                )}
            </div>

            <div className="flex items-center gap-2">
                {node.homepage && (
                    <a
                        href={node.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        {t.viewDetails}
                    </a>
                )}
                {onInstall && (
                    <button
                        onClick={() => onInstall(node)}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                        {t.install}
                    </button>
                )}
            </div>
        </div>
    );
}

export type { CommunityNode, NodeSource, SearchResult };
