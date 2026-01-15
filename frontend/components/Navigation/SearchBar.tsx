'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, X, Plus, ChevronDown, ChevronRight,
    Globe, Mail, Database, Clock, GitBranch, Code, MessageSquare,
    FileText, Calendar, Webhook, Send, Key, Zap, Settings,
    Cloud, Server, Hash, Play, Pause, RefreshCw, Filter,
    AlertCircle, List, Grid, Shuffle, Bell
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { WorkflowNode } from '../Editor';
import { NODE_TYPES, NodeType, CATEGORIES } from '../Node';

interface SearchBarProps {
    nodes: WorkflowNode[];
    onNodeSelect: (nodeId: string) => void;
    onNodeAdd: (type: NodeType) => void;
    onHighlightNodes: (nodeIds: string[]) => void;
    lang: 'en' | 'es';
    availableNodeTypes?: NodeType[]; // Dynamic list from DB
}

export default function SearchBar({ nodes, onNodeSelect, onNodeAdd, onHighlightNodes, lang: langProp, availableNodeTypes }: SearchBarProps) {
    const lang = (langProp === 'en' || langProp === 'es') ? langProp : 'en';
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['triggers', 'core']);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const content = {
        en: {
            search: 'Search nodes...',
            addNew: 'Add New',
            onCanvas: 'On Canvas',
            noResults: 'No nodes found',
            clickToAdd: 'Click to add',
        },
        es: {
            search: 'Buscar nodos...',
            addNew: 'Agregar Nuevo',
            onCanvas: 'En Canvas',
            noResults: 'No se encontraron nodos',
            clickToAdd: 'Clic para agregar',
        },
    };

    const text = content[lang] || content['en'];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    // Filter available nodes (for adding new)
    const filteredAvailableNodes = useMemo(() => {
        const sourceNodes = availableNodeTypes && availableNodeTypes.length > 0 ? availableNodeTypes : NODE_TYPES;
        if (!searchTerm) return sourceNodes;
        const term = searchTerm.toLowerCase();
        return sourceNodes.filter(t =>
            (t.label[lang] || t.label['en'] || '').toLowerCase().includes(term) ||
            t.type.toLowerCase().includes(term) ||
            (t.description?.[lang] || '').toLowerCase().includes(term)
        );
    }, [searchTerm, lang]);

    // Filter existing nodes on canvas
    const filteredCanvasNodes = useMemo(() => {
        if (!searchTerm) return [];
        return nodes.filter(node =>
            node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.type.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [nodes, searchTerm]);

    // Group nodes by category
    const nodesByCategory = useMemo(() => {
        const grouped: Record<string, NodeType[]> = {};
        CATEGORIES.forEach(cat => {
            grouped[cat.id] = filteredAvailableNodes.filter(node => node.category === cat.id);
        });
        return grouped;
    }, [filteredAvailableNodes]);

    useEffect(() => {
        if (searchTerm) {
            onHighlightNodes(filteredCanvasNodes.map(n => n.id));
        } else {
            onHighlightNodes([]);
        }
    }, [filteredCanvasNodes, onHighlightNodes, searchTerm]);

    const handleAddNode = (nodeType: NodeType) => {
        onNodeAdd(nodeType);
        setSearchTerm('');
        setIsOpen(false);
    };

    const handleNodeClick = (nodeId: string) => {
        onNodeSelect(nodeId);
        setIsOpen(false);
    };

    const handleClear = () => {
        setSearchTerm('');
        onHighlightNodes([]);
    };

    const hasSearchResults = searchTerm && (filteredAvailableNodes.length > 0 || filteredCanvasNodes.length > 0);
    const showCategories = isOpen && !searchTerm;

    return (
        <div ref={containerRef} className="absolute top-4 right-4 z-50 w-96">
            <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl shadow-2xl overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2d2d44]">
                    <Search size={18} className="text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder={text.search}
                        className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
                    />
                    {searchTerm && (
                        <button
                            onClick={handleClear}
                            className="text-gray-500 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Dropdown Content */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="max-h-[70vh] overflow-y-auto">
                                {/* Search Results */}
                                {searchTerm ? (
                                    <>
                                        {/* Available Nodes to Add */}
                                        {filteredAvailableNodes.length > 0 && (
                                            <div className="border-b border-[#2d2d44]">
                                                <div className="px-4 py-2 bg-[#0d0d1a] text-xs uppercase font-bold text-blue-400 tracking-wider">
                                                    {text.addNew}
                                                </div>
                                                <div className="p-2">
                                                    {filteredAvailableNodes.slice(0, 8).map(nodeType => (
                                                        <NodeItem
                                                            key={nodeType.type}
                                                            nodeType={nodeType}
                                                            lang={lang}
                                                            onClick={() => handleAddNode(nodeType)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Existing Canvas Nodes */}
                                        {filteredCanvasNodes.length > 0 && (
                                            <div>
                                                <div className="px-4 py-2 bg-[#0d0d1a] text-xs uppercase font-bold text-gray-500 tracking-wider">
                                                    {text.onCanvas} ({filteredCanvasNodes.length})
                                                </div>
                                                <div className="p-2">
                                                    {filteredCanvasNodes.map(node => (
                                                        <motion.div
                                                            key={node.id}
                                                            className="px-3 py-2.5 hover:bg-[#22223a] rounded-lg cursor-pointer transition-colors"
                                                            whileHover={{ x: 4 }}
                                                            onClick={() => handleNodeClick(node.id)}
                                                        >
                                                            <div className="text-sm text-gray-200 font-medium">{node.title}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{node.type}</div>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* No Results */}
                                        {filteredAvailableNodes.length === 0 && filteredCanvasNodes.length === 0 && (
                                            <div className="p-6 text-center text-gray-500 text-sm">
                                                {text.noResults}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* Categories View */
                                    CATEGORIES.map((category) => {
                                        const categoryNodes = nodesByCategory[category.id];
                                        if (!categoryNodes || categoryNodes.length === 0) return null;
                                        const isExpanded = expandedCategories.includes(category.id);
                                        const CategoryIcon = category.icon;

                                        return (
                                            <div key={category.id} className="border-b border-[#2d2d44] last:border-0">
                                                <button
                                                    onClick={() => toggleCategory(category.id)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#22223a] transition-colors group"
                                                >
                                                    <div className={`${category.color} transition-colors`}>
                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </div>
                                                    <CategoryIcon size={16} className={category.color} />
                                                    <span className="text-sm font-medium text-gray-200 flex-1 text-left">
                                                        {category.label[lang]}
                                                    </span>
                                                    <span className="text-xs text-gray-500 bg-[#2d2d44] px-2 py-0.5 rounded-full">
                                                        {categoryNodes.length}
                                                    </span>
                                                </button>

                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden bg-[#0d0d1a]/50"
                                                        >
                                                            <div className="p-2 pl-4">
                                                                {categoryNodes.map((nodeType) => (
                                                                    <NodeItem
                                                                        key={nodeType.type}
                                                                        nodeType={nodeType}
                                                                        lang={lang}
                                                                        onClick={() => handleAddNode(nodeType)}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function NodeItem({
    nodeType,
    lang,
    onClick
}: {
    nodeType: NodeType;
    lang: 'en' | 'es';
    onClick: () => void;
}) {
    return (
        <motion.div
            onClick={onClick}
            className="flex items-center gap-3 px-3 py-2.5 bg-[#1a1a2e] hover:bg-[#22223a] rounded-lg cursor-pointer transition-all group mb-1.5 last:mb-0 border border-transparent hover:border-[#3d3d5c]"
            whileHover={{ scale: 1.01, x: 2 }}
            whileTap={{ scale: 0.98 }}
        >
            <div className={`w-9 h-9 ${nodeType.color} rounded-lg flex items-center justify-center text-white shadow-md`}>
                {nodeType.icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 font-medium truncate group-hover:text-white transition-colors">
                    {nodeType.label[lang] || nodeType.label['en']}
                </div>
                {nodeType.description && (
                    <div className="text-xs text-gray-500 truncate">
                        {nodeType.description[lang] || nodeType.description['en']}
                    </div>
                )}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400">
                <Plus size={16} />
            </div>
        </motion.div>
    );
}
