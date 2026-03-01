'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, X, Plus, ChevronDown, Folder
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { WorkflowNode } from '../Editor';
import { NodeType, CATEGORIES } from '../Node';

interface SearchBarProps {
    nodes: WorkflowNode[];
    onNodeSelect: (nodeId: string) => void;
    onNodeAdd: (type: NodeType) => void;
    onHighlightNodes: (nodeIds: string[]) => void;
    lang: 'en' | 'es';
    availableNodeTypes?: NodeType[]; // Dynamic list from DB
    position?: { x: number; y: number }; // Absolute position override
    forceOpen?: boolean; // Keep it open (for context menu usage)
    externalTrigger?: number; // Timestamp to trigger open/focus
}

export default function SearchBar({ nodes, onNodeSelect, onNodeAdd, onHighlightNodes, lang: langProp, availableNodeTypes, position, forceOpen, externalTrigger }: SearchBarProps) {
    const lang = (langProp === 'en' || langProp === 'es') ? langProp : 'en';
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(forceOpen || false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['triggers', 'core', 'integrations']);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-focus if forced open
    useEffect(() => {
        if (forceOpen && inputRef.current) {
            inputRef.current.focus();
            setIsOpen(true);
        }
    }, [forceOpen]);

    // External Trigger (for Toolbar button)
    useEffect(() => {
        if (externalTrigger) {
            setIsOpen(true);
        }
    }, [externalTrigger]);

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

    const filteredAvailableNodes = useMemo(() => {
        const sourceNodes = availableNodeTypes || [];

        // Deduplicate by type to prevent React key errors
        const uniqueNodes = Array.from(
            new Map(sourceNodes.map(node => [node.type, node])).values()
        );

        if (!searchTerm) return uniqueNodes;
        const term = searchTerm.toLowerCase();
        return uniqueNodes.filter(t =>
            (t.label[lang] || t.label['en'] || '').toLowerCase().includes(term) ||
            t.type.toLowerCase().includes(term) ||
            (t.description?.[lang] || '').toLowerCase().includes(term) ||
            (t.subtitle?.[lang] || '').toLowerCase().includes(term)
        );
    }, [searchTerm, lang, availableNodeTypes]);

    // Filter existing nodes on canvas
    const filteredCanvasNodes = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        return nodes.filter(node =>
            node.title.toLowerCase().includes(term) ||
            node.type.toLowerCase().includes(term)
        );
    }, [nodes, searchTerm]);

    // Build the hierarchical tree
    const categoryTree = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        filteredAvailableNodes.forEach(node => {
            const parts = node.category.split('/');
            const rootId = parts[0];

            // If it doesn't match an existing top category, default to integrations
            const targetRoot = root[rootId] ? rootId : 'integrations';
            let current = root[targetRoot];

            // If it was a path like integrations/google/sheets, handle sub-path
            if (parts.length > 1) {
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
    }, [filteredAvailableNodes, lang]);

    useEffect(() => {
        if (searchTerm) {
            onHighlightNodes(filteredCanvasNodes.map(n => n.id));
        } else {
            onHighlightNodes([]);
        }
    }, [filteredCanvasNodes, onHighlightNodes, searchTerm]);

    const handleClear = () => {
        setSearchTerm('');
        inputRef.current?.focus();
    };

    const handleAddNode = (nodeType: NodeType) => {
        onNodeAdd(nodeType);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleNodeClick = (nodeId: string) => {
        onNodeSelect(nodeId);
        setIsOpen(false);
        setSearchTerm('');
    };

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            // Small timeout to ensure DOM is ready
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    if (!isOpen && !forceOpen) return null;

    const isCenter = !position;

    return (
        <div
            ref={containerRef}
            className={`
                search-bar-container
                ${isCenter ? 'fixed left-1/2 top-[15%] -translate-x-1/2 w-full max-w-lg' : 'absolute w-72'}
                z-50
            `}
            style={!isCenter ? { left: (position as any).x, top: (position as any).y } : {}}
        >
            <motion.div
                className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                initial={{ scale: 0.95, opacity: 0, y: -20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
                {/* Search Input Area */}
                <div className="flex items-center gap-3 px-5 py-4 bg-white/[0.02] border-b border-white/10">
                    <Search size={20} className="text-orange-500 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        placeholder={text.search}
                        className="flex-1 bg-transparent border-none outline-none text-white text-base placeholder-gray-500 font-medium"
                        autoFocus={forceOpen}
                    />
                    {searchTerm && (
                        <button
                            onClick={handleClear}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white"
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
                                                    {filteredAvailableNodes.slice(0, 12).map(nodeType => (
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
                                    /* Categories Hierarchy View */
                                    CATEGORIES.map((cat) => (
                                        <CategoryFolder
                                            key={cat.id}
                                            category={categoryTree[cat.id]}
                                            lang={lang}
                                            expandedCategories={expandedCategories}
                                            onToggle={toggleCategory}
                                            onAddNode={handleAddNode}
                                            depth={0}
                                        />
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

function CategoryFolder({
    category,
    lang,
    expandedCategories,
    onToggle,
    onAddNode,
    depth = 0
}: {
    category: any;
    lang: 'en' | 'es';
    expandedCategories: string[];
    onToggle: (id: string) => void;
    onAddNode: (node: NodeType) => void;
    depth?: number;
}) {
    if (!category) return null;
    const isExpanded = expandedCategories.includes(category.id);
    const hasSubCategories = Object.keys(category.subCategories).length > 0;
    const hasNodes = category.nodes.length > 0;
    if (!hasSubCategories && !hasNodes) return null;

    const Icon = category.icon || Folder;

    return (
        <div className={`border-b border-white/[0.05] last:border-0 ${depth > 0 ? 'bg-white/[0.02]' : ''}`}>
            <button
                onClick={() => onToggle(category.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] transition-all group"
                style={{ paddingLeft: `${(depth * 16) + 20}px` }}
            >
                <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'} opacity-50`}>
                    <ChevronDown size={14} className="text-gray-400" />
                </div>
                <div className={`p-1.5 rounded-lg ${category.color || 'bg-slate-500/20 text-slate-400'} bg-opacity-20 flex items-center justify-center shrink-0`}>
                    <Icon size={14} className={category.color?.replace('bg-', 'text-') || 'text-slate-400'} />
                </div>
                <span className="text-sm font-semibold text-gray-200 flex-1 text-left truncate group-hover:text-white transition-colors">
                    {category.label}
                </span>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <span className="text-[10px] text-gray-400 font-mono bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                    {category.nodes.length + Object.values(category.subCategories).reduce((acc: number, cur: any) => acc + cur.nodes.length, 0)}
                </span>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden relative"
                    >
                        {/* Vertical line indicator for hierarchy */}
                        {depth >= 0 && (
                            <div
                                className="absolute left-[26px] top-0 bottom-6 w-[1px] bg-white/10"
                                style={{ left: `${(depth * 16) + 26}px` }}
                            />
                        )}

                        {/* Recursive Subcategories */}
                        {Object.values(category.subCategories).map((sub: any) => (
                            <CategoryFolder
                                key={sub.id}
                                category={sub}
                                lang={lang}
                                expandedCategories={expandedCategories}
                                onToggle={onToggle}
                                onAddNode={onAddNode}
                                depth={depth + 1}
                            />
                        ))}

                        {/* Nodes in this category */}
                        {hasNodes && (
                            <div className="py-1 px-2" style={{ paddingLeft: `${((depth + 1) * 16) + 12}px` }}>
                                {category.nodes.map((nodeType: NodeType) => (
                                    <NodeItem
                                        key={nodeType.type}
                                        nodeType={nodeType}
                                        lang={lang}
                                        onClick={() => onAddNode(nodeType)}
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
                {nodeType.subtitle?.[lang] && (
                    <div className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">
                        {nodeType.subtitle[lang]}
                    </div>
                )}
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
