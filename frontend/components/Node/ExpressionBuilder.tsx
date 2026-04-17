'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Database, ChevronRight, ChevronDown, Copy, Check, Variable, FunctionSquare, FileJson, Play } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { WorkflowNode, Connection } from '@cairn/shared';

// Extend WorkflowNode locally to avoid TS errors if shared type is incomplete
interface ExtendedNode extends WorkflowNode {
    data: {
        label?: string;
        [key: string]: any;
    };
}

interface ExpressionBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (expression: string) => void;
    nodes: WorkflowNode[];
    connections: Connection[];
    lang: 'en' | 'es';
}

// Available expression functions
const EXPRESSION_FUNCTIONS = [
    // String functions
    { name: '$toUpper', description: { en: 'Convert to uppercase', es: 'Convertir a mayúsculas' }, example: '$toUpper("hello") => "HELLO"', category: 'string' },
    { name: '$toLower', description: { en: 'Convert to lowercase', es: 'Convertir a minúsculas' }, example: '$toLower("HELLO") => "hello"', category: 'string' },
    { name: '$trim', description: { en: 'Remove whitespace', es: 'Eliminar espacios' }, example: '$trim(" hello ") => "hello"', category: 'string' },
    { name: '$substring', description: { en: 'Extract substring', es: 'Extraer subcadena' }, example: '$substring(str, start, length)', category: 'string' },
    { name: '$replace', description: { en: 'Replace text', es: 'Reemplazar texto' }, example: '$replace(str, "old", "new")', category: 'string' },
    { name: '$split', description: { en: 'Split string to array', es: 'Dividir cadena en array' }, example: '$split("a,b,c", ",") => ["a","b","c"]', category: 'string' },
    { name: '$join', description: { en: 'Join array to string', es: 'Unir array en cadena' }, example: '$join(["a","b"], "-") => "a-b"', category: 'string' },
    { name: '$concat', description: { en: 'Concatenate strings', es: 'Concatenar cadenas' }, example: '$concat("Hello", " ", "World")', category: 'string' },
    { name: '$length', description: { en: 'Get string/array length', es: 'Obtener longitud' }, example: '$length("hello") => 5', category: 'string' },

    // Number functions
    { name: '$round', description: { en: 'Round number', es: 'Redondear número' }, example: '$round(3.7) => 4', category: 'number' },
    { name: '$floor', description: { en: 'Round down', es: 'Redondear hacia abajo' }, example: '$floor(3.7) => 3', category: 'number' },
    { name: '$ceil', description: { en: 'Round up', es: 'Redondear hacia arriba' }, example: '$ceil(3.2) => 4', category: 'number' },
    { name: '$abs', description: { en: 'Absolute value', es: 'Valor absoluto' }, example: '$abs(-5) => 5', category: 'number' },
    { name: '$min', description: { en: 'Minimum value', es: 'Valor mínimo' }, example: '$min(1, 2, 3) => 1', category: 'number' },
    { name: '$max', description: { en: 'Maximum value', es: 'Valor máximo' }, example: '$max(1, 2, 3) => 3', category: 'number' },
    { name: '$sum', description: { en: 'Sum array values', es: 'Sumar valores de array' }, example: '$sum([1, 2, 3]) => 6', category: 'number' },
    { name: '$average', description: { en: 'Average of array', es: 'Promedio de array' }, example: '$average([1, 2, 3]) => 2', category: 'number' },

    // Array functions
    { name: '$first', description: { en: 'Get first element', es: 'Obtener primer elemento' }, example: '$first([1,2,3]) => 1', category: 'array' },
    { name: '$last', description: { en: 'Get last element', es: 'Obtener último elemento' }, example: '$last([1,2,3]) => 3', category: 'array' },
    { name: '$reverse', description: { en: 'Reverse array', es: 'Invertir array' }, example: '$reverse([1,2,3]) => [3,2,1]', category: 'array' },
    { name: '$sort', description: { en: 'Sort array', es: 'Ordenar array' }, example: '$sort([3,1,2]) => [1,2,3]', category: 'array' },
    { name: '$unique', description: { en: 'Remove duplicates', es: 'Eliminar duplicados' }, example: '$unique([1,1,2]) => [1,2]', category: 'array' },
    { name: '$filter', description: { en: 'Filter array', es: 'Filtrar array' }, example: '$filter(array, condition)', category: 'array' },
    { name: '$map', description: { en: 'Transform array', es: 'Transformar array' }, example: '$map(array, transform)', category: 'array' },
    { name: '$count', description: { en: 'Count elements', es: 'Contar elementos' }, example: '$count([1,2,3]) => 3', category: 'array' },

    // Date functions
    { name: '$now', description: { en: 'Current timestamp', es: 'Timestamp actual' }, example: '$now() => "2024-01-15T..."', category: 'date' },
    { name: '$today', description: { en: 'Today\'s date', es: 'Fecha de hoy' }, example: '$today() => "2024-01-15"', category: 'date' },
    { name: '$formatDate', description: { en: 'Format date', es: 'Formatear fecha' }, example: '$formatDate(date, "YYYY-MM-DD")', category: 'date' },
    { name: '$parseDate', description: { en: 'Parse date string', es: 'Parsear fecha' }, example: '$parseDate("2024-01-15")', category: 'date' },
    { name: '$addDays', description: { en: 'Add days to date', es: 'Agregar días' }, example: '$addDays(date, 7)', category: 'date' },
    { name: '$diffDays', description: { en: 'Days between dates', es: 'Días entre fechas' }, example: '$diffDays(date1, date2)', category: 'date' },

    // Object functions
    { name: '$keys', description: { en: 'Get object keys', es: 'Obtener claves' }, example: '$keys({a:1, b:2}) => ["a","b"]', category: 'object' },
    { name: '$values', description: { en: 'Get object values', es: 'Obtener valores' }, example: '$values({a:1, b:2}) => [1,2]', category: 'object' },
    { name: '$merge', description: { en: 'Merge objects', es: 'Combinar objetos' }, example: '$merge(obj1, obj2)', category: 'object' },
    { name: '$pick', description: { en: 'Pick properties', es: 'Seleccionar propiedades' }, example: '$pick(obj, ["a", "b"])', category: 'object' },
    { name: '$omit', description: { en: 'Omit properties', es: 'Omitir propiedades' }, example: '$omit(obj, ["password"])', category: 'object' },

    // Logic functions
    { name: '$if', description: { en: 'Conditional', es: 'Condicional' }, example: '$if(condition, then, else)', category: 'logic' },
    { name: '$isEmpty', description: { en: 'Check if empty', es: 'Verificar si vacío' }, example: '$isEmpty("") => true', category: 'logic' },
    { name: '$isNull', description: { en: 'Check if null', es: 'Verificar si nulo' }, example: '$isNull(null) => true', category: 'logic' },
    { name: '$coalesce', description: { en: 'First non-null', es: 'Primer no-nulo' }, example: '$coalesce(null, "default")', category: 'logic' },
];

// Built-in variables
const BUILTIN_VARIABLES = [
    { name: '$input', description: { en: 'Input data from trigger', es: 'Datos de entrada del trigger' }, example: '$input.body' },
    { name: '$env', description: { en: 'Environment variables', es: 'Variables de entorno' }, example: '$env.API_KEY' },
    { name: '$execution', description: { en: 'Current execution info', es: 'Info de ejecución actual' }, example: '$execution.id' },
    { name: '$workflow', description: { en: 'Workflow metadata', es: 'Metadatos del workflow' }, example: '$workflow.name' },
    { name: '$timestamp', description: { en: 'Current timestamp', es: 'Timestamp actual' }, example: '$timestamp' },
    { name: '$random', description: { en: 'Random number 0-1', es: 'Número aleatorio 0-1' }, example: '$random' },
    { name: '$uuid', description: { en: 'Generate UUID', es: 'Generar UUID' }, example: '$uuid' },
];

const FUNCTION_CATEGORIES = [
    { id: 'string', label: { en: 'String', es: 'Cadena' } },
    { id: 'number', label: { en: 'Number', es: 'Número' } },
    { id: 'array', label: { en: 'Array', es: 'Array' } },
    { id: 'date', label: { en: 'Date', es: 'Fecha' } },
    { id: 'object', label: { en: 'Object', es: 'Objeto' } },
    { id: 'logic', label: { en: 'Logic', es: 'Lógica' } },
];

export default function ExpressionBuilder({ isOpen, onClose, onInsert, nodes, connections: _connections, lang }: ExpressionBuilderProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'nodes' | 'functions' | 'variables'>('nodes');
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['string']);
    const [previewExpression, setPreviewExpression] = useState('');
    const [copiedItem, setCopiedItem] = useState<string | null>(null);

    const text = {
        en: {
            title: 'Expression Builder',
            search: 'Search...',
            insert: 'Insert',
            copy: 'Copy',
            noNodes: 'No nodes available.',
            output: 'Output Data',
            preview: 'Preview',
            previewPlaceholder: 'Enter expression to preview...',
            tabs: {
                nodes: 'Node Data',
                functions: 'Functions',
                variables: 'Variables'
            },
            categories: 'Categories',
            clickToInsert: 'Click to insert',
            result: 'Result',
            testExpression: 'Test Expression'
        },
        es: {
            title: 'Constructor de Expresiones',
            search: 'Buscar...',
            insert: 'Insertar',
            copy: 'Copiar',
            noNodes: 'No hay nodos disponibles.',
            output: 'Datos de Salida',
            preview: 'Vista Previa',
            previewPlaceholder: 'Ingresa expresión para previsualizar...',
            tabs: {
                nodes: 'Datos de Nodo',
                functions: 'Funciones',
                variables: 'Variables'
            },
            categories: 'Categorías',
            clickToInsert: 'Clic para insertar',
            result: 'Resultado',
            testExpression: 'Probar Expresión'
        }
    }[lang];

    // Toggle node expansion
    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev =>
            prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
        );
    };

    // Toggle category expansion
    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
        );
    };

    // Filter nodes based on search
    const filteredNodes = useMemo(() => {
        return (nodes as ExtendedNode[]).filter(n =>
            n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.type?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [nodes, searchTerm]);

    // Filter functions based on search
    const filteredFunctions = useMemo(() => {
        if (!searchTerm) return EXPRESSION_FUNCTIONS;
        return EXPRESSION_FUNCTIONS.filter(f =>
            f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.description[lang].toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, lang]);

    // Filter variables based on search
    const filteredVariables = useMemo(() => {
        if (!searchTerm) return BUILTIN_VARIABLES;
        return BUILTIN_VARIABLES.filter(v =>
            v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.description[lang].toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, lang]);

    // Mock output schema for demonstration based on node type
    const getMockOutput = (node: WorkflowNode) => {
        if (node.type.toLowerCase().includes('webhook')) return { body: { key: 'value', id: 123, user: { name: 'John', email: 'john@example.com' } }, query: { page: 1 }, headers: { 'content-type': 'application/json' } };
        if (node.type.toLowerCase().includes('openai')) return { content: 'Response text...', role: 'assistant', usage: { tokens: 150 } };
        if (node.type.toLowerCase().includes('code')) return { result: 'calculated value', success: true, data: [1, 2, 3] };
        if (node.type.toLowerCase().includes('http')) return { status: 200, data: { items: [], total: 0 }, headers: {} };
        return { data: 'sample data', id: Math.floor(Math.random() * 1000) };
    };

    const handleVariableClick = useCallback((nodeName: string, path: string[]) => {
        const pathString = path.map(p => `["${p}"]`).join('');
        const expression = `{{ $node["${nodeName}"].json${pathString} }}`;
        onInsert(expression);
        onClose();
    }, [onInsert, onClose]);

    const handleFunctionClick = useCallback((funcName: string) => {
        const expression = `{{ ${funcName}() }}`;
        onInsert(expression);
        onClose();
    }, [onInsert, onClose]);

    const handleVariableInsert = useCallback((varName: string) => {
        const expression = `{{ ${varName} }}`;
        onInsert(expression);
        onClose();
    }, [onInsert, onClose]);

    const handleCopy = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedItem(text);
        setTimeout(() => setCopiedItem(null), 2000);
    }, []);

    // Mock expression evaluation for preview
    const evaluatePreview = useCallback((expr: string) => {
        if (!expr.trim()) return null;
        try {
            // Simple mock evaluation - in production this would call the backend
            if (expr.includes('$now')) return new Date().toISOString();
            if (expr.includes('$today')) return new Date().toISOString().split('T')[0];
            if (expr.includes('$random')) return Math.random().toFixed(4);
            if (expr.includes('$uuid')) return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
            if (expr.includes('$toUpper')) return '"EXAMPLE"';
            if (expr.includes('$toLower')) return '"example"';
            return '(Preview available after execution)';
        } catch {
            return 'Invalid expression';
        }
    }, []);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-[#1a1a2e] border border-gray-700 shadow-2xl rounded-lg w-[700px] h-[600px] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-[#16162a]">
                            <div className="flex items-center gap-2 text-white font-bold">
                                <Database size={18} className="text-primary/70" />
                                {text.title}
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-700 bg-[#16162a]">
                            <button
                                onClick={() => setActiveTab('nodes')}
                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                    activeTab === 'nodes'
                                        ? 'text-primary/70 border-b-2 border-primary/70 bg-primary/70/10'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                <FileJson size={14} />
                                {text.tabs.nodes}
                            </button>
                            <button
                                onClick={() => setActiveTab('functions')}
                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                    activeTab === 'functions'
                                        ? 'text-primary/70 border-b-2 border-primary/70 bg-primary/70/10'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                <FunctionSquare size={14} />
                                {text.tabs.functions}
                            </button>
                            <button
                                onClick={() => setActiveTab('variables')}
                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                    activeTab === 'variables'
                                        ? 'text-primary/70 border-b-2 border-primary/70 bg-primary/70/10'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                <Variable size={14} />
                                {text.tabs.variables}
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-3 border-b border-gray-700 bg-black/20">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder={text.search}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#0d0d1a] border border-gray-700 rounded-md pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {/* Nodes Tab */}
                            {activeTab === 'nodes' && (
                                <>
                                    {filteredNodes.length === 0 ? (
                                        <div className="text-center text-gray-500 mt-10 text-sm">{text.noNodes}</div>
                                    ) : (
                                        filteredNodes.map(node => {
                                            const isExpanded = expandedNodes.includes(node.id);
                                            const mockData = getMockOutput(node);
                                            const nodeName = node.title || node.id;

                                            return (
                                                <div key={node.id} className="mb-2 border border-gray-700/50 rounded bg-[#1f1f35]">
                                                    <button
                                                        onClick={() => toggleNode(node.id)}
                                                        className="w-full flex items-center gap-2 p-2 hover:bg-white/5 transition-colors text-left"
                                                    >
                                                        {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                                                        <span className="text-sm font-semibold text-gray-200">{nodeName}</span>
                                                        <span className="text-[10px] text-gray-500 ml-auto bg-black/30 px-1.5 py-0.5 rounded">{node.type.split('.').pop()}</span>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="p-2 pl-6 border-t border-gray-700/30 bg-black/20 font-mono text-xs">
                                                            <RecursiveObjectRenderer
                                                                data={mockData}
                                                                path={[]}
                                                                onSelect={(path) => handleVariableClick(nodeName, path)}
                                                                onCopy={handleCopy}
                                                                copiedItem={copiedItem}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </>
                            )}

                            {/* Functions Tab */}
                            {activeTab === 'functions' && (
                                <div className="space-y-2">
                                    {FUNCTION_CATEGORIES.map(category => {
                                        const categoryFunctions = filteredFunctions.filter(f => f.category === category.id);
                                        if (categoryFunctions.length === 0) return null;
                                        const isExpanded = expandedCategories.includes(category.id);

                                        return (
                                            <div key={category.id} className="border border-gray-700/50 rounded bg-[#1f1f35]">
                                                <button
                                                    onClick={() => toggleCategory(category.id)}
                                                    className="w-full flex items-center gap-2 p-2 hover:bg-white/5 transition-colors text-left"
                                                >
                                                    {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                                                    <span className="text-sm font-semibold text-gray-200">{category.label[lang]}</span>
                                                    <span className="text-[10px] text-gray-500 ml-auto bg-black/30 px-1.5 py-0.5 rounded">{categoryFunctions.length}</span>
                                                </button>

                                                {isExpanded && (
                                                    <div className="border-t border-gray-700/30 bg-black/20">
                                                        {categoryFunctions.map(func => (
                                                            <div
                                                                key={func.name}
                                                                className="flex items-center justify-between p-2 hover:bg-white/5 cursor-pointer group"
                                                                onClick={() => handleFunctionClick(func.name)}
                                                            >
                                                                <div className="flex-1">
                                                                    <div className="text-sm text-primary/40 font-mono">{func.name}</div>
                                                                    <div className="text-[10px] text-gray-500">{func.description[lang]}</div>
                                                                    <div className="text-[10px] text-gray-600 font-mono mt-0.5">{func.example}</div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleCopy(func.name); }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                                                                >
                                                                    {copiedItem === func.name ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-gray-400" />}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Variables Tab */}
                            {activeTab === 'variables' && (
                                <div className="space-y-1">
                                    {filteredVariables.map(variable => (
                                        <div
                                            key={variable.name}
                                            className="flex items-center justify-between p-3 hover:bg-white/5 rounded cursor-pointer group border border-gray-700/30 bg-[#1f1f35]"
                                            onClick={() => handleVariableInsert(variable.name)}
                                        >
                                            <div className="flex-1">
                                                <div className="text-sm text-primary/40 font-mono">{variable.name}</div>
                                                <div className="text-[10px] text-gray-500">{variable.description[lang]}</div>
                                                <div className="text-[10px] text-gray-600 font-mono mt-0.5">Example: {variable.example}</div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCopy(variable.name); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                                            >
                                                {copiedItem === variable.name ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-gray-400" />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Preview Section */}
                        <div className="border-t border-gray-700 bg-[#16162a] p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Play size={12} className="text-gray-400" />
                                <span className="text-[10px] font-bold uppercase text-gray-500">{text.preview}</span>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={previewExpression}
                                    onChange={(e) => setPreviewExpression(e.target.value)}
                                    placeholder={text.previewPlaceholder}
                                    className="flex-1 bg-[#0d0d1a] border border-gray-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary"
                                />
                                <button
                                    onClick={() => previewExpression && onInsert(`{{ ${previewExpression} }}`)}
                                    disabled={!previewExpression.trim()}
                                    className="px-3 py-2 bg-primary hover:bg-primary disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium transition-colors"
                                >
                                    {text.insert}
                                </button>
                            </div>
                            {previewExpression && (
                                <div className="mt-2 p-2 bg-black/30 rounded border border-gray-700/50">
                                    <span className="text-[10px] text-gray-500 uppercase">{text.result}: </span>
                                    <span className="text-xs text-green-400 font-mono">{evaluatePreview(previewExpression)}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

// Recursive helper to render JSON tree with copy functionality
function RecursiveObjectRenderer({
    data,
    path,
    onSelect,
    onCopy,
    copiedItem
}: {
    data: any;
    path: string[];
    onSelect: (path: string[]) => void;
    onCopy: (text: string) => void;
    copiedItem: string | null;
}) {
    if (typeof data === 'object' && data !== null) {
        return (
            <div className="flex flex-col gap-1">
                {Object.entries(data).map(([key, value]) => {
                    const currentPath = [...path, key];
                    const pathString = currentPath.join('.');

                    return (
                        <div key={key}>
                            <div className="flex items-start gap-1 group">
                                <span className="text-primary/40">{key}:</span>
                                {typeof value === 'object' && value !== null ? (
                                    <div className="ml-2 border-l border-gray-700 pl-2">
                                        <RecursiveObjectRenderer
                                            data={value}
                                            path={currentPath}
                                            onSelect={onSelect}
                                            onCopy={onCopy}
                                            copiedItem={copiedItem}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span
                                            className="text-green-300 cursor-pointer hover:underline hover:text-green-200 truncate max-w-[200px]"
                                            onClick={() => onSelect(currentPath)}
                                            title="Click to insert"
                                        >
                                            {JSON.stringify(value)}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onCopy(pathString); }}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all"
                                        >
                                            {copiedItem === pathString ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="text-gray-400" />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
}
