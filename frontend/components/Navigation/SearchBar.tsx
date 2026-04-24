'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { WorkflowNode } from '../Editor';
import { CATEGORIES, NODE_TYPES, NodeType } from '../Node';

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

export default function SearchBar({
  nodes,
  onNodeSelect,
  onNodeAdd,
  onHighlightNodes,
  lang: langProp,
  availableNodeTypes,
  position,
  forceOpen,
  externalTrigger,
}: SearchBarProps) {
  const lang = langProp === 'en' || langProp === 'es' ? langProp : 'en';
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(forceOpen || false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['triggers', 'core']);
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
        if (!forceOpen) setIsOpen(false); // Only close if not forced (or maybe we want to close menu on outside click anyway?)
        // Actually for context menu we DO want to close on outside click
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [forceOpen]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  // Filter available nodes (for adding new)
  const filteredAvailableNodes = useMemo(() => {
    const sourceNodes =
      availableNodeTypes && availableNodeTypes.length > 0 ? availableNodeTypes : NODE_TYPES;
    if (!searchTerm) return sourceNodes;
    const term = searchTerm.toLowerCase();
    return sourceNodes.filter(
      t =>
        (t.label[lang] || t.label['en'] || '').toLowerCase().includes(term) ||
        t.type.toLowerCase().includes(term) ||
        (t.description?.[lang] || '').toLowerCase().includes(term)
    );
  }, [searchTerm, lang, availableNodeTypes]);

  // Filter existing nodes on canvas
  const filteredCanvasNodes = useMemo(() => {
    if (!searchTerm) return [];
    return nodes.filter(
      node =>
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

    // If contextual (forced open), we likely want to keep it open?
    // No, actually dropping a node should close the menu.
    // But if we are in forceOpen mode, isOpen is controlled by props?
    // Actually isOpen is state initialized by forceOpen.
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

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small timeout to ensure DOM is ready
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  if (!isOpen && !forceOpen) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute z-50 w-96 ${position ? '' : 'left-1/2 top-20 -ml-48'}`} // Centered top position (below Toolbar)
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <div className="overflow-hidden rounded-xl border border-[#2d2d44] bg-[#1a1a2e] shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-[#2d2d44] px-4 py-3">
          <Search size={18} className="text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={text.search}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={handleClear}
              className="text-gray-500 transition-colors hover:text-white"
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
                        <div className="text-primary/70 bg-[#0d0d1a] px-4 py-2 text-xs font-bold uppercase tracking-wider">
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
                        <div className="bg-[#0d0d1a] px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                          {text.onCanvas} ({filteredCanvasNodes.length})
                        </div>
                        <div className="p-2">
                          {filteredCanvasNodes.map(node => (
                            <motion.div
                              key={node.id}
                              className="cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-[#22223a]"
                              whileHover={{ x: 4 }}
                              onClick={() => handleNodeClick(node.id)}
                            >
                              <div className="text-sm font-medium text-gray-200">{node.title}</div>
                              <div className="mt-0.5 text-xs text-gray-500">{node.type}</div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No Results */}
                    {filteredAvailableNodes.length === 0 && filteredCanvasNodes.length === 0 && (
                      <div className="p-6 text-center text-sm text-gray-500">{text.noResults}</div>
                    )}
                  </>
                ) : (
                  /* Categories View */
                  CATEGORIES.map(category => {
                    const categoryNodes = nodesByCategory[category.id];
                    if (!categoryNodes || categoryNodes.length === 0) return null;
                    const isExpanded = expandedCategories.includes(category.id);
                    const CategoryIcon = category.icon;

                    return (
                      <div key={category.id} className="border-b border-[#2d2d44] last:border-0">
                        <button
                          onClick={() => toggleCategory(category.id)}
                          className="group flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-[#22223a]"
                        >
                          <div className={`${category.color} transition-colors`}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </div>
                          <CategoryIcon size={16} className={category.color} />
                          <span className="flex-1 text-left text-sm font-medium text-gray-200">
                            {category.label[lang]}
                          </span>
                          <span className="rounded-full bg-[#2d2d44] px-2 py-0.5 text-xs text-gray-500">
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
                                {categoryNodes.map(nodeType => (
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
  onClick,
}: {
  nodeType: NodeType;
  lang: 'en' | 'es';
  onClick: () => void;
}) {
  return (
    <motion.div
      onClick={onClick}
      className="group mb-1.5 flex cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-[#1a1a2e] px-3 py-2.5 transition-all last:mb-0 hover:border-[#3d3d5c] hover:bg-[#22223a]"
      whileHover={{ scale: 1.01, x: 2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className={`h-9 w-9 ${nodeType.color} flex items-center justify-center rounded-lg text-white shadow-md`}
      >
        {nodeType.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-200 transition-colors group-hover:text-white">
          {nodeType.label[lang] || nodeType.label['en']}
        </div>
        {nodeType.description && (
          <div className="truncate text-xs text-gray-500">
            {nodeType.description[lang] || nodeType.description['en']}
          </div>
        )}
      </div>
      <div className="text-primary/70 opacity-0 transition-opacity group-hover:opacity-100">
        <Plus size={16} />
      </div>
    </motion.div>
  );
}
