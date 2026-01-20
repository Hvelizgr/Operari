'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ChevronRight, Search, X,
    Globe, Folder, Zap, Box, MessageSquare
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNodeTypes } from '@/hooks/useNodeTypes';

export interface NodeType {
    type: string;
    icon: React.ReactNode;
    label: { en: string; es: string };
    color: string;
    category: string;
    description?: { en: string; es: string };
    subtitle?: { en: string; es: string };
    inputs?: string[];
    outputs?: string[];
    properties?: any[];
}

const CATEGORIES = [
    { id: 'triggers', label: { en: 'Triggers', es: 'Disparadores' }, icon: Zap, color: 'text-orange-400' },
    { id: 'core', label: { en: 'Core', es: 'Core' }, icon: Box, color: 'text-blue-400' },
    { id: 'ai', label: { en: 'AI & LLM', es: 'IA y LLM' }, icon: MessageSquare, color: 'text-rose-400' },
    { id: 'organization', label: { en: 'Organization', es: 'Organización' }, icon: Folder, color: 'text-slate-400' },
    { id: 'integrations', label: { en: 'Services', es: 'Servicios' }, icon: Globe, color: 'text-emerald-400' },
];

interface NodePaletteProps {
    lang: 'en' | 'es';
    onNodeDragStart: (nodeType: NodeType) => void;
}

export default function NodePalette({ lang: langProp, onNodeDragStart }: NodePaletteProps) {
    const lang = (langProp === 'en' || langProp === 'es') ? langProp : 'en';
    const [isOpen, setIsOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['triggers', 'core', 'ai', 'organization', 'integrations']);
    const [searchTerm, setSearchTerm] = useState('');

    const { nodeTypes: apiNodes } = useNodeTypes();

    const allNodes = useMemo(() => {
        return apiNodes as NodeType[];
    }, [apiNodes]);

    // Categories are static for now, reusing global CATEGORIES constant


    const content = {
        en: {
            title: 'Nodes',
            subtitle: 'Drag to canvas or click +',
            toggle: isOpen ? 'Close' : 'Add node',
            search: 'Search nodes...',
        },
        es: {
            title: 'Nodos',
            subtitle: 'Arrastra al canvas o clic en +',
            toggle: isOpen ? 'Cerrar' : 'Agregar nodo',
            search: 'Buscar nodos...',
        },
    };

    const text = (content as any)[lang] || content['en'];

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const filteredNodes = useMemo(() => {
        if (!searchTerm) return allNodes;
        const term = searchTerm.toLowerCase();
        return allNodes.filter(node =>
            (node.label[lang] || '').toLowerCase().includes(term) ||
            node.type.toLowerCase().includes(term) ||
            (node.description?.[lang] || '').toLowerCase().includes(term)
        );
    }, [searchTerm, lang, allNodes]);

    // Build the hierarchical tree
    const categoryTree = useMemo(() => {
        const root: Record<string, any> = {};

        // 1. Initialize top-level categories
        CATEGORIES.forEach(cat => {
            root[cat.id] = {
                id: cat.id,
                label: cat.label[lang],
                icon: cat.icon,
                color: cat.color,
                nodes: [],
                subCategories: {}
            };
        });

        // 2. Distribute nodes
        filteredNodes.forEach(node => {
            const parts = node.category.split('/');
            const rootId = parts[0];

            // If it doesn't match an existing top category, default to integrations
            const targetRoot = root[rootId] ? rootId : 'integrations';
            let current = root[targetRoot];

            // If it was a path like integrations/google/sheets, handle sub-path
            if (parts.length > 1) {
                // start from index 1 if it matched "integrations"
                // but wait, if category was "integrations/google", parts[0] is "integrations"
                const subPathParts = parts.slice(1);
                subPathParts.forEach((part, idx) => {
                    const fullPath = [targetRoot, ...subPathParts.slice(0, idx + 1)].join('/');
                    if (!current.subCategories[part]) {
                        current.subCategories[part] = {
                            id: fullPath,
                            label: part.charAt(0).toUpperCase() + part.slice(1).replace('-', ' '),
                            nodes: [],
                            subCategories: {}
                        };
                    }
                    current = current.subCategories[part];
                });
            }

            current.nodes.push(node);
        });

        return root;
    }, [filteredNodes, lang]);

    const hasResults = filteredNodes.length > 0;

    return (
        <motion.div
            className="absolute left-4 top-20 z-40 flex flex-col gap-2"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            onWheel={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls="node-palette-content"
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-orange-500/30 self-start"
            >
                <Zap size={16} />
                {text.toggle}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id="node-palette-content"
                        className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl shadow-2xl w-80 overflow-hidden"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-[#2d2d44] bg-[#1a1a2e]">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <Box size={18} className="text-orange-400" />
                                    {text.title}
                                </h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{text.subtitle}</p>
                        </div>

                        {/* Search */}
                        <div className="p-3 border-b border-[#2d2d44] bg-[#16162a]">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={text.search}
                                    className="w-full bg-[#0d0d1a] border border-[#2d2d44] rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Categories */}
                        <div className="max-h-[60vh] overflow-y-auto">
                            {!hasResults ? (
                                <div className="p-6 text-center text-gray-500 text-sm">
                                    {lang === 'en' ? 'No nodes found' : 'No se encontraron nodos'}
                                </div>
                            ) : searchTerm ? (
                                <div className="p-2">
                                    {filteredNodes.map((nodeType) => (
                                        <NodeItem
                                            key={nodeType.type}
                                            nodeType={nodeType}
                                            lang={lang}
                                            onDragStart={onNodeDragStart}
                                        />
                                    ))}
                                </div>
                            ) : (
                                CATEGORIES.map((cat) => (
                                    <CategoryFolder
                                        key={cat.id}
                                        category={categoryTree[cat.id]}
                                        lang={lang}
                                        expandedCategories={expandedCategories}
                                        onToggle={toggleCategory}
                                        onNodeDragStart={onNodeDragStart}
                                        depth={0}
                                    />
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function CategoryFolder({
    category,
    lang,
    expandedCategories,
    onToggle,
    onNodeDragStart,
    depth = 0
}: {
    category: any;
    lang: 'en' | 'es';
    expandedCategories: string[];
    onToggle: (id: string) => void;
    onNodeDragStart: (nodeType: NodeType) => void;
    depth?: number;
}) {
    if (!category) return null;
    const isExpanded = expandedCategories.includes(category.id);
    const hasSubCategories = Object.keys(category.subCategories).length > 0;
    const hasNodes = category.nodes.length > 0;
    if (!hasSubCategories && !hasNodes) return null;

    const Icon = category.icon || Folder;

    return (
        <div className={`border-b border-[#2d2d44] last:border-0 ${depth > 0 ? 'bg-black/10' : ''}`}>
            <button
                onClick={() => onToggle(category.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#22223a] transition-colors group"
                style={{ paddingLeft: `${(depth * 12) + 16}px` }}
            >
                <div className={`${category.color || 'text-slate-400'} transition-colors`}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <Icon size={16} className={category.color || 'text-slate-400'} />
                <span className="text-sm font-medium text-gray-200 flex-1 text-left truncate">
                    {category.label}
                </span>
                <span className="text-[10px] text-gray-500 bg-[#2d2d44] px-1.5 py-0.5 rounded-full">
                    {category.nodes.length + Object.values(category.subCategories).reduce((acc: number, cur: any) => acc + cur.nodes.length, 0)}
                </span>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {/* Recursive Subcategories */}
                        {Object.values(category.subCategories).map((sub: any) => (
                            <CategoryFolder
                                key={sub.id}
                                category={sub}
                                lang={lang}
                                expandedCategories={expandedCategories}
                                onToggle={onToggle}
                                onNodeDragStart={onNodeDragStart}
                                depth={depth + 1}
                            />
                        ))}

                        {/* Nodes in this category */}
                        {hasNodes && (
                            <div className="p-2" style={{ paddingLeft: `${(depth * 12) + 16}px` }}>
                                {category.nodes.map((nodeType: NodeType) => (
                                    <NodeItem
                                        key={nodeType.type}
                                        nodeType={nodeType}
                                        lang={lang}
                                        onDragStart={onNodeDragStart}
                                    />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function NodeItem({
    nodeType,
    lang,
    onDragStart
}: {
    nodeType: NodeType;
    lang: 'en' | 'es';
    onDragStart: (nodeType: NodeType) => void;
}) {
    return (
        <motion.div
            draggable
            onDragStart={() => onDragStart(nodeType)}
            className="flex items-center gap-3 px-3 py-2.5 bg-[#1a1a2e] hover:bg-[#22223a] rounded-lg cursor-move transition-all group mb-1.5 last:mb-0 border border-transparent hover:border-[#3d3d5c]"
            whileHover={{ scale: 1.01, x: 2 }}
            whileTap={{ scale: 0.98 }}
        >
            <div className={`w-9 h-9 ${nodeType.color} rounded-lg flex items-center justify-center text-white shadow-md`}>
                {nodeType.icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 font-medium truncate group-hover:text-white transition-colors">
                    {nodeType.label[lang]}
                </div>
                {nodeType.subtitle?.[lang] && (
                    <div className="text-[10px] text-orange-400 font-medium uppercase tracking-wider mb-0.5">
                        {nodeType.subtitle[lang]}
                    </div>
                )}
                {nodeType.description && (
                    <div className="text-xs text-gray-500 truncate">
                        {nodeType.description[lang]}
                    </div>
                )}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            </div>
        </motion.div>
    );
}

export { CATEGORIES };
