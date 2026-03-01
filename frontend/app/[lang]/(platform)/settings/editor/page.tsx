'use client';

import { Card, CardBody, CardHeader, Switch, Slider, Button, Chip, Tabs, Tab } from "@heroui/react";
import { Monitor, MousePointer, Palette, Zap, Cpu, Sparkles, Keyboard, Save, RotateCcw, Check, Box, Circle, Square, Diamond, Hexagon, Minus, Activity, Play, GitBranch, Target, Layers, X } from "lucide-react";
import { useState, useEffect } from "react";
import { 
    useEditorTheme, 
    THEME_LABELS, 
    NODE_STYLE_LABELS, 
    TRIGGER_NODE_STYLE_LABELS,
    ACTION_NODE_STYLE_LABELS,
    CONDITION_NODE_STYLE_LABELS,
    CONNECTION_STYLE_LABELS,
    CONNECTION_PATH_STYLE_LABELS,
    FLOW_ANIMATION_LABELS,
    CONNECTION_BADGE_STYLE_LABELS,
    THEME_CONFIGS, 
    EditorTheme, 
    NodeStyle, 
    TriggerNodeStyle,
    ActionNodeStyle,
    ConditionNodeStyle,
    ConnectionStyle,
    ConnectionPathStyle,
    FlowAnimation,
    ConnectionBadgeStyle,
    NodeCategoryColors,
    DEFAULT_NODE_CATEGORY_COLORS
} from "@/context/EditorThemeContext";
import { 
    useKeyboardShortcuts, 
    CATEGORY_LABELS, 
    ShortcutAction, 
    ShortcutConfig 
} from "@/context/KeyboardShortcutsContext";
import '@/styles/editor-themes.css';

const NODE_CATEGORY_LABELS: Record<keyof NodeCategoryColors, { label: string; description: string; icon: string }> = {
    triggers: { label: 'Disparadores', description: 'Nodos que inician un flujo', icon: '⚡' },
    actions: { label: 'Acciones', description: 'Nodos que ejecutan tareas', icon: '🎯' },
    logic: { label: 'Lógica', description: 'Condicionales y control de flujo', icon: '🔀' },
    integrations: { label: 'Integraciones', description: 'Conexiones con servicios externos', icon: '🔗' },
    ai: { label: 'Inteligencia Artificial', description: 'Nodos de AI/LLM', icon: '🤖' },
    utilities: { label: 'Utilidades', description: 'Herramientas y helpers', icon: '🔧' },
};

export default function EditorSettingsPage() {
    const { 
        config, 
        setTheme, 
        setNodeStyle, 
        setTriggerNodeStyle,
        setActionNodeStyle,
        setConditionNodeStyle,
        setConnectionStyle, 
        setConnectionPathStyle,
        setFlowAnimation,
        setShowConnectionBadges,
        setConnectionBadgeStyle,
        setNodeCategoryColor,
        setMinimapCollapsed,
        setTerminalCollapsed,
        resetToDefaults 
    } = useEditorTheme();

    
    const [gridSnapping, setGridSnapping] = useState(true);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setHasChanges(true);
    }, [config]);

    const handleSave = () => {
        setHasChanges(false);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 text-white min-h-screen">
            <div className="flex justify-between items-end border-b border-[#27272a] pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Editor Configuration</h1>
                    <p className="text-gray-400 mt-2">Customize themes, node styles, connections, and animations.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="flat" className="bg-[#18181b] text-gray-300" startContent={<RotateCcw size={16} />} onPress={resetToDefaults}>
                        Reset
                    </Button>
                    <Button color="primary" startContent={<Save size={16} />} onPress={handleSave} isDisabled={!hasChanges}>
                        Save
                    </Button>
                </div>
            </div>

            <Tabs aria-label="Settings sections" color="primary" variant="underlined" classNames={{ tabList: "gap-6", cursor: "bg-primary", tab: "px-0 h-12" }}>
                <Tab key="themes" title={<div className="flex items-center gap-2"><Palette size={16} />Themes</div>}>
                    <div className="mt-6">
                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6">
                                <div>
                                    <h3 className="text-lg font-bold">Editor Theme</h3>
                                    <p className="text-xs text-gray-500">8 color schemes for your canvas</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {(Object.keys(THEME_LABELS) as EditorTheme[]).map((theme) => (
                                        <button
                                            key={theme}
                                            onClick={() => setTheme(theme)}
                                            className={`relative overflow-hidden rounded-xl p-4 transition-all duration-200 h-28 ${
                                                config.theme === theme 
                                                    ? 'ring-2 ring-offset-2 ring-offset-[#18181b]' 
                                                    : 'hover:scale-[1.02]'
                                            }`}
                                            style={{ 
                                                background: `linear-gradient(135deg, ${THEME_CONFIGS[theme].background} 0%, ${THEME_CONFIGS[theme].surface} 50%, ${THEME_CONFIGS[theme].primary}15 100%)`,
                                                boxShadow: config.theme === theme ? `0 0 0 2px ${THEME_CONFIGS[theme].primary}` : undefined
                                            }}
                                        >
                                            <div className="flex flex-col h-full justify-between">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm" style={{ color: THEME_CONFIGS[theme].text }}>
                                                        {THEME_LABELS[theme]}
                                                    </span>
                                                    {config.theme === theme && (
                                                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                                                            <Check size={12} className="text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    {['primary', 'secondary', 'accent', 'success'].map((colorKey) => (
                                                        <div
                                                            key={colorKey}
                                                            className="w-5 h-5 rounded-md shadow-inner"
                                                            style={{ backgroundColor: THEME_CONFIGS[theme][colorKey as keyof typeof THEME_CONFIGS[typeof theme]] }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key="nodes" title={<div className="flex items-center gap-2"><Box size={16} />Node Styles</div>}>
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Box size={20} /></div>
                                <div>
                                    <h3 className="text-lg font-bold">General Node Style</h3>
                                    <p className="text-xs text-gray-500">Default shape for all nodes</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.keys(NODE_STYLE_LABELS) as NodeStyle[]).map((style) => (
                                        <button
                                            key={style}
                                            onClick={() => setNodeStyle(style)}
                                            className={`p-3 rounded-xl border transition-all duration-200 flex items-center gap-3 ${
                                                config.nodeStyle === style 
                                                    ? 'border-blue-500 bg-blue-500/10' 
                                                    : 'border-[#27272a] hover:border-[#3f3f46] bg-[#09090b]'
                                            }`}
                                        >
                                            <span className="font-medium text-sm">{NODE_STYLE_LABELS[style]}</span>
                                            {config.nodeStyle === style && <Check size={14} className="ml-auto text-blue-400" />}
                                        </button>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><Play size={20} /></div>
                                <div>
                                    <h3 className="text-lg font-bold">Trigger Node Style</h3>
                                    <p className="text-xs text-gray-500">Style for trigger/start nodes</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="grid grid-cols-1 gap-3">
                                    {(Object.keys(TRIGGER_NODE_STYLE_LABELS) as TriggerNodeStyle[]).map((style) => (
                                        <button
                                            key={style}
                                            onClick={() => setTriggerNodeStyle(style)}
                                            className={`p-3 rounded-xl border transition-all duration-200 flex items-center gap-3 ${
                                                config.triggerNodeStyle === style 
                                                    ? 'border-green-500 bg-green-500/10' 
                                                    : 'border-[#27272a] hover:border-[#3f3f46] bg-[#09090b]'
                                            }`}
                                        >
                                            <span className="font-medium text-sm">{TRIGGER_NODE_STYLE_LABELS[style]}</span>
                                            {config.triggerNodeStyle === style && <Check size={14} className="ml-auto text-green-400" />}
                                        </button>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500"><Target size={20} /></div>
                                <div>
                                    <h3 className="text-lg font-bold">Action Node Style</h3>
                                    <p className="text-xs text-gray-500">Style for action/task nodes</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="grid grid-cols-1 gap-3">
                                    {(Object.keys(ACTION_NODE_STYLE_LABELS) as ActionNodeStyle[]).map((style) => (
                                        <button
                                            key={style}
                                            onClick={() => setActionNodeStyle(style)}
                                            className={`p-3 rounded-xl border transition-all duration-200 flex items-center gap-3 ${
                                                config.actionNodeStyle === style 
                                                    ? 'border-purple-500 bg-purple-500/10' 
                                                    : 'border-[#27272a] hover:border-[#3f3f46] bg-[#09090b]'
                                            }`}
                                        >
                                            <span className="font-medium text-sm">{ACTION_NODE_STYLE_LABELS[style]}</span>
                                            {config.actionNodeStyle === style && <Check size={14} className="ml-auto text-purple-400" />}
                                        </button>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500"><GitBranch size={20} /></div>
                                <div>
                                    <h3 className="text-lg font-bold">Condition Node Style</h3>
                                    <p className="text-xs text-gray-500">Style for decision/branch nodes</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="grid grid-cols-1 gap-3">
                                    {(Object.keys(CONDITION_NODE_STYLE_LABELS) as ConditionNodeStyle[]).map((style) => (
                                        <button
                                            key={style}
                                            onClick={() => setConditionNodeStyle(style)}
                                            className={`p-3 rounded-xl border transition-all duration-200 flex items-center gap-3 ${
                                                config.conditionNodeStyle === style 
                                                    ? 'border-orange-500 bg-orange-500/10' 
                                                    : 'border-[#27272a] hover:border-[#3f3f46] bg-[#09090b]'
                                            }`}
                                        >
                                            <span className="font-medium text-sm">{CONDITION_NODE_STYLE_LABELS[style]}</span>
                                            {config.conditionNodeStyle === style && <Check size={14} className="ml-auto text-orange-400" />}
                                        </button>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key="node-colors" title={<div className="flex items-center gap-2"><Layers size={16} />Colores de Nodos</div>}>
                    <div className="mt-6">
                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6">
                                <div>
                                    <h3 className="text-lg font-bold">Colores por Categoría</h3>
                                    <p className="text-xs text-gray-500">Personaliza los colores base de cada tipo de nodo</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(Object.keys(NODE_CATEGORY_LABELS) as (keyof NodeCategoryColors)[]).map((category) => (
                                        <div
                                            key={category}
                                            className="p-4 rounded-xl border border-[#27272a] bg-[#09090b] hover:border-[#3f3f46] transition-all"
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className="text-2xl">{NODE_CATEGORY_LABELS[category].icon}</span>
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{NODE_CATEGORY_LABELS[category].label}</p>
                                                    <p className="text-xs text-gray-500">{NODE_CATEGORY_LABELS[category].description}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-10 h-10 rounded-lg border border-white/10 shadow-lg"
                                                    style={{ backgroundColor: config.nodeCategoryColors[category] }}
                                                />
                                                <input
                                                    type="color"
                                                    value={config.nodeCategoryColors[category]}
                                                    onChange={(e) => setNodeCategoryColor(category, e.target.value)}
                                                    className="w-full h-10 rounded-lg cursor-pointer bg-transparent border border-[#27272a]"
                                                />
                                                <button
                                                    onClick={() => setNodeCategoryColor(category, DEFAULT_NODE_CATEGORY_COLORS[category])}
                                                    className="px-3 py-2 text-xs rounded-lg border border-[#27272a] hover:bg-[#27272a] transition-colors"
                                                    title="Restaurar color por defecto"
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                        
                        <Card className="bg-[#18181b] border border-[#27272a] mt-6">
                            <CardHeader className="px-6 pt-6">
                                <div>
                                    <h3 className="text-lg font-bold">Vista Previa</h3>
                                    <p className="text-xs text-gray-500">Así se verán los nodos en el editor</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="flex flex-wrap gap-4">
                                    {(Object.keys(NODE_CATEGORY_LABELS) as (keyof NodeCategoryColors)[]).map((category) => (
                                        <div
                                            key={category}
                                            className="relative p-4 rounded-xl border-2 min-w-[140px]"
                                            style={{ 
                                                borderColor: config.nodeCategoryColors[category],
                                                background: `linear-gradient(135deg, ${config.nodeCategoryColors[category]}15 0%, transparent 100%)`
                                            }}
                                        >
                                            <div 
                                                className="w-8 h-8 rounded-lg mb-2 flex items-center justify-center text-white text-sm font-bold"
                                                style={{ backgroundColor: config.nodeCategoryColors[category] }}
                                            >
                                                {NODE_CATEGORY_LABELS[category].icon}
                                            </div>
                                            <p className="text-sm font-medium">{NODE_CATEGORY_LABELS[category].label}</p>
                                            <p className="text-xs text-gray-500 mt-1">{category}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key="connections" title={<div className="flex items-center gap-2"><Minus size={16} />Connections</div>}>
                    <div className="mt-6 space-y-6">
                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6">
                                <div>
                                    <h3 className="text-lg font-bold">Connection Path Style</h3>
                                    <p className="text-xs text-gray-500">Shape of the connection line path</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {(Object.keys(CONNECTION_PATH_STYLE_LABELS) as ConnectionPathStyle[]).map((style) => (
                                        <button
                                            key={style}
                                            onClick={() => setConnectionPathStyle(style)}
                                            className={`p-4 rounded-xl border transition-all duration-200 ${
                                                config.connectionPathStyle === style 
                                                    ? 'border-emerald-500 bg-emerald-500/10' 
                                                    : 'border-[#27272a] hover:border-[#3f3f46] bg-[#09090b]'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="font-medium text-sm">{CONNECTION_PATH_STYLE_LABELS[style]}</span>
                                                {config.connectionPathStyle === style && <Check size={14} className="text-emerald-400" />}
                                            </div>
                                            <div className="h-12 relative">
                                                <svg width="100%" height="48" className="overflow-visible">
                                                    {style === 'bezier' && (
                                                        <path 
                                                            d="M10,40 C40,40 60,8 90,8" 
                                                            stroke={config.connectionPathStyle === style ? '#10b981' : '#71717a'}
                                                            strokeWidth="2"
                                                            fill="none"
                                                        />
                                                    )}
                                                    {style === 'step' && (
                                                        <path 
                                                            d="M10,40 H50 V8 H90" 
                                                            stroke={config.connectionPathStyle === style ? '#10b981' : '#71717a'}
                                                            strokeWidth="2"
                                                            fill="none"
                                                        />
                                                    )}
                                                    {style === 'smoothstep' && (
                                                        <path 
                                                            d="M10,40 H40 Q50,40 50,30 V18 Q50,8 60,8 H90" 
                                                            stroke={config.connectionPathStyle === style ? '#10b981' : '#71717a'}
                                                            strokeWidth="2"
                                                            fill="none"
                                                        />
                                                    )}
                                                    {style === 'straight' && (
                                                        <path 
                                                            d="M10,40 L90,8" 
                                                            stroke={config.connectionPathStyle === style ? '#10b981' : '#71717a'}
                                                            strokeWidth="2"
                                                            fill="none"
                                                        />
                                                    )}
                                                    <circle cx="10" cy={style === 'straight' ? 40 : 40} r="4" fill={config.connectionPathStyle === style ? '#10b981' : '#71717a'} />
                                                    <circle cx="90" cy="8" r="4" fill={config.connectionPathStyle === style ? '#10b981' : '#71717a'} />
                                                </svg>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6">
                                <div>
                                    <h3 className="text-lg font-bold">Connection Line Style</h3>
                                    <p className="text-xs text-gray-500">8 styles for connector lines</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {(Object.keys(CONNECTION_STYLE_LABELS) as ConnectionStyle[]).map((style) => (
                                        <button
                                            key={style}
                                            onClick={() => setConnectionStyle(style)}
                                            className={`p-4 rounded-xl border transition-all duration-200 ${
                                                config.connectionStyle === style 
                                                    ? 'border-cyan-500 bg-cyan-500/10' 
                                                    : 'border-[#27272a] hover:border-[#3f3f46] bg-[#09090b]'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="font-medium text-sm">{CONNECTION_STYLE_LABELS[style]}</span>
                                                {config.connectionStyle === style && <Check size={14} className="text-cyan-400" />}
                                            </div>
                                            <div className="h-[3px] relative">
                                                <svg width="100%" height="3" className="overflow-visible">
                                                    <path 
                                                        d="M0,1.5 C30,1.5 70,1.5 100,1.5" 
                                                        stroke={config.connectionStyle === style ? '#22d3ee' : '#71717a'}
                                                        strokeWidth="2"
                                                        fill="none"
                                                        strokeDasharray={
                                                            style === 'dashed' ? '8 4' : 
                                                            style === 'dotted' ? '2 4' : 
                                                            style === 'animated-flow' ? '8 4' : 
                                                            'none'
                                                        }
                                                        strokeLinecap={style === 'dotted' ? 'round' : 'butt'}
                                                        className={style === 'animated-flow' ? 'animate-[connection-flow_1s_linear_infinite]' : ''}
                                                        style={style === 'glow-line' ? { filter: 'drop-shadow(0 0 4px #22d3ee)' } : {}}
                                                    />
                                                </svg>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500"><Monitor size={20} /></div>
                                <div>
                                    <h3 className="text-lg font-bold">Visibility</h3>
                                    <p className="text-xs text-gray-500">Control connection indicators visibility</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="flex justify-between items-center p-4 rounded-xl border border-[#27272a] bg-[#09090b]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                                            <Check size={14} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Connection Status Badges</p>
                                            <p className="text-xs text-gray-500">Show status icons (bubbles) on connection lines</p>
                                        </div>
                                    </div>
                                    <Switch 
                                        isSelected={config.showConnectionBadges} 
                                        onValueChange={setShowConnectionBadges} 
                                        size="sm" 
                                        color="primary" 
                                    />
                                </div>
                            </CardBody>
                        </Card>

                        {config.showConnectionBadges && (
                            <Card className="bg-[#18181b] border border-[#27272a]">
                                <CardHeader className="px-6 pt-6">
                                    <div>
                                        <h3 className="text-lg font-bold">Badge Style</h3>
                                        <p className="text-xs text-gray-500">Choose how connection status badges look</p>
                                    </div>
                                </CardHeader>
                                <CardBody className="px-6 pb-6">
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                        {(Object.keys(CONNECTION_BADGE_STYLE_LABELS) as ConnectionBadgeStyle[]).map((style) => (
                                            <button
                                                key={style}
                                                onClick={() => setConnectionBadgeStyle(style)}
                                                className={`p-4 rounded-xl border transition-all duration-200 ${
                                                    config.connectionBadgeStyle === style 
                                                        ? 'border-blue-500 bg-blue-500/10' 
                                                        : 'border-[#27272a] hover:border-[#3f3f46] bg-[#09090b]'
                                                }`}
                                            >
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="h-10 flex items-center justify-center">
                                                        {style === 'minimal' && (
                                                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center border-2 border-white/20">
                                                                <Circle size={10} className="text-white" />
                                                            </div>
                                                        )}
                                                        {style === 'pill' && (
                                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500 border border-white/15">
                                                                <Check size={10} className="text-white" />
                                                                <span className="text-[9px] font-semibold text-white uppercase">Success</span>
                                                            </div>
                                                        )}
                                                        {style === 'icon-only' && (
                                                            <div className="w-6 h-6 rounded-md bg-purple-500 flex items-center justify-center border border-white/10">
                                                                <Check size={14} className="text-white" />
                                                            </div>
                                                        )}
                                                        {style === 'status-dot' && (
                                                            <div className="w-3 h-3 rounded-full bg-cyan-500 border-2 border-white/30 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                                                        )}
                                                        {style === 'label' && (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center border-2 border-white/20">
                                                                    <GitBranch size={10} className="text-white" />
                                                                </div>
                                                                <span className="text-[8px] font-semibold text-orange-500 bg-black/80 px-1.5 py-0.5 rounded">Cond</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-xs text-center">{CONNECTION_BADGE_STYLE_LABELS[style]}</span>
                                                    {config.connectionBadgeStyle === style && <Check size={14} className="text-blue-400" />}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </CardBody>
                            </Card>
                        )}
                    </div>
                </Tab>

                <Tab key="animations" title={<div className="flex items-center gap-2"><Activity size={16} />Animations</div>}>
                    <div className="mt-6">
                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6">
                                <div>
                                    <h3 className="text-lg font-bold">Flow Animation</h3>
                                    <p className="text-xs text-gray-500">8 animation styles during execution</p>
                                </div>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {(Object.keys(FLOW_ANIMATION_LABELS) as FlowAnimation[]).map((anim) => (
                                        <button
                                            key={anim}
                                            onClick={() => setFlowAnimation(anim)}
                                            className={`p-4 rounded-xl border transition-all duration-200 ${
                                                config.flowAnimation === anim 
                                                    ? 'border-pink-500 bg-pink-500/10' 
                                                    : 'border-[#27272a] hover:border-[#3f3f46] bg-[#09090b]'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="font-medium text-sm">{FLOW_ANIMATION_LABELS[anim]}</span>
                                                {config.flowAnimation === anim && <Check size={14} className="text-pink-400" />}
                                            </div>
                                            <div className={`animation-preview ${anim.replace('-', '')}`}>
                                                <div className="preview-line" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key="settings" title={<div className="flex items-center gap-2"><Cpu size={16} />Settings</div>}>
                    <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500"><MousePointer size={20} /></div>
                                <h3 className="text-lg font-bold">Interaction</h3>
                            </CardHeader>
                            <CardBody className="px-6 pb-6 gap-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">Snap to Grid</p>
                                        <p className="text-xs text-gray-500">Align nodes automatically</p>
                                    </div>
                                    <Switch isSelected={gridSnapping} onValueChange={setGridSnapping} size="sm" color="secondary" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">Minimap Collapsed</p>
                                        <p className="text-xs text-gray-500">Start with minimap collapsed</p>
                                    </div>
                                    <Switch isSelected={config.minimapCollapsed} onValueChange={setMinimapCollapsed} size="sm" color="secondary" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">Terminal Collapsed</p>
                                        <p className="text-xs text-gray-500">Start with terminal collapsed</p>
                                    </div>
                                    <Switch isSelected={config.terminalCollapsed} onValueChange={setTerminalCollapsed} size="sm" color="secondary" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">Auto-save</p>
                                        <p className="text-xs text-gray-500">Save changes automatically</p>
                                    </div>
                                    <Switch defaultSelected size="sm" color="success" />
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><Keyboard size={20} /></div>
                                <h3 className="text-lg font-bold">Shortcuts</h3>
                            </CardHeader>
                            <CardBody className="px-6 pb-6">
                                <div className="space-y-4">
                                    <KeybindRow label="Save" keys={['Ctrl', 'S']} />
                                    <KeybindRow label="Execute" keys={['Ctrl', '↵']} />
                                    <KeybindRow label="Palette" keys={['Ctrl', 'K']} />
                                    <KeybindRow label="Add Node" keys={['Space']} />
                                    <KeybindRow label="Zoom" keys={['Ctrl', '+/-']} />
                                    <KeybindRow label="Context Menu" keys={['Right Click']} />
                                </div>
                                <div className="mt-4 p-3 bg-[#09090b] rounded-lg border border-[#27272a]">
                                    <p className="text-xs text-gray-400">
                                        <strong className="text-gray-300">Tip:</strong> Right-click on a node to access the context menu with options like Detach Connections, Toggle Breakpoint, and more.
                                    </p>
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="bg-[#18181b] border border-[#27272a]">
                            <CardHeader className="px-6 pt-6 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500"><Cpu size={20} /></div>
                                <h3 className="text-lg font-bold">Performance</h3>
                            </CardHeader>
                            <CardBody className="px-6 pb-6 gap-6">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-medium">Max FPS</span>
                                        <span className="text-xs text-gray-400">60</span>
                                    </div>
                                    <Slider 
                                        aria-label="FPS" 
                                        size="sm" 
                                        step={15} 
                                        minValue={30} 
                                        maxValue={120} 
                                        defaultValue={60} 
                                        color="warning"
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-sm">Reduced Motion</p>
                                        <p className="text-xs text-gray-500">Less animations</p>
                                    </div>
                                    <Switch size="sm" color="warning" />
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    <Card className="bg-gradient-to-br from-[#18181b] to-purple-900/10 border border-purple-500/30 mt-6">
                        <CardHeader className="px-6 pt-6 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500"><Sparkles size={20} /></div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Experimental</h3>
                                <p className="text-xs text-purple-300">Coming soon</p>
                            </div>
                        </CardHeader>
                        <CardBody className="px-6 pb-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-[#09090b]/50 border border-purple-500/20 rounded-xl flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-white">AI Copilot v2</p>
                                            <Chip size="sm" color="secondary" variant="flat" className="text-[10px] h-5">BETA</Chip>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Node suggestions</p>
                                    </div>
                                    <Switch size="sm" color="secondary" />
                                </div>
                                <div className="p-4 bg-[#09090b]/50 border border-purple-500/20 rounded-xl flex justify-between items-center opacity-60">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-gray-300">Multi-cursor</p>
                                            <Chip size="sm" variant="flat" className="text-[10px] h-5">SOON</Chip>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Collaboration</p>
                                    </div>
                                    <Switch size="sm" isDisabled />
                                </div>
                                <div className="p-4 bg-[#09090b]/50 border border-purple-500/20 rounded-xl flex justify-between items-center opacity-60">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm text-gray-300">VIM Mode</p>
                                            <Chip size="sm" variant="flat" className="text-[10px] h-5">SOON</Chip>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Keyboard nav</p>
                                    </div>
                                    <Switch size="sm" isDisabled />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Tab>

                <Tab key="shortcuts" title={<div className="flex items-center gap-2"><Keyboard size={16} />Shortcuts</div>}>
                    <ShortcutsTab />
                </Tab>
            </Tabs>
        </div>
    );
}

function ShortcutsTab() {
    const { shortcuts, updateShortcut, resetToDefaults, formatShortcut } = useKeyboardShortcuts();
    const [editingAction, setEditingAction] = useState<string | null>(null);
    const [recordedKeys, setRecordedKeys] = useState<ShortcutConfig | null>(null);

    const categories = ['general', 'nodes', 'selection', 'navigation', 'execution'] as const;

    const handleStartEdit = (action: string) => {
        setEditingAction(action);
        setRecordedKeys(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!editingAction) return;
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
            setEditingAction(null);
            setRecordedKeys(null);
            return;
        }

        const newShortcut: ShortcutConfig = {
            key: e.key,
            ctrl: e.ctrlKey || e.metaKey,
            shift: e.shiftKey,
            alt: e.altKey,
        };
        setRecordedKeys(newShortcut);
    };

    const handleSaveShortcut = () => {
        if (editingAction && recordedKeys) {
            updateShortcut(editingAction as ShortcutAction, recordedKeys);
            setEditingAction(null);
            setRecordedKeys(null);
        }
    };

    const handleCancelEdit = () => {
        setEditingAction(null);
        setRecordedKeys(null);
    };

    return (
        <div className="mt-6 space-y-6">
            <Card className="bg-[#18181b] border border-[#27272a]">
                <CardHeader className="px-6 pt-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Keyboard size={20} /></div>
                        <div>
                            <h3 className="text-lg font-bold">Keyboard Shortcuts</h3>
                            <p className="text-xs text-gray-500">Click on a shortcut to customize it</p>
                        </div>
                    </div>
                    <Button 
                        variant="flat" 
                        size="sm" 
                        className="bg-[#27272a]" 
                        startContent={<RotateCcw size={14} />}
                        onPress={resetToDefaults}
                    >
                        Reset All
                    </Button>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {categories.map(category => {
                            const categoryShortcuts = shortcuts.filter(s => s.category === category);
                            if (categoryShortcuts.length === 0) return null;

                            return (
                                <div key={category} className="space-y-3">
                                    <h4 className="text-sm font-bold uppercase text-blue-400 tracking-wider border-b border-[#27272a] pb-2">
                                        {CATEGORY_LABELS[category].es}
                                    </h4>
                                    <div className="space-y-2">
                                        {categoryShortcuts.map(shortcut => {
                                            const isEditing = editingAction === shortcut.action;
                                            
                                            return (
                                                <div 
                                                    key={shortcut.action} 
                                                    className={`flex justify-between items-center p-3 rounded-lg transition-all ${
                                                        isEditing 
                                                            ? 'bg-blue-500/20 border border-blue-500' 
                                                            : 'bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46]'
                                                    }`}
                                                >
                                                    <span className="text-sm text-gray-300">{shortcut.label.es}</span>
                                                    
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                 type="button"
                                                                 onKeyDown={handleKeyDown}
                                                                 className="px-3 py-1.5 bg-[#18181b] border border-blue-500 rounded-md text-xs font-mono text-blue-400 min-w-[120px] text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                             >
                                                                 {recordedKeys ? formatShortcut(recordedKeys) : 'Press keys...'}
                                                             </button>
                                                            <Button 
                                                                size="sm" 
                                                                color="success" 
                                                                isIconOnly 
                                                                variant="flat"
                                                                onPress={handleSaveShortcut}
                                                                isDisabled={!recordedKeys}
                                                            >
                                                                <Check size={14} />
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                color="danger" 
                                                                isIconOnly 
                                                                variant="flat"
                                                                onPress={handleCancelEdit}
                                                            >
                                                                <X size={14} />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartEdit(shortcut.action)}
                                                            className="flex gap-1 hover:opacity-80 transition-opacity"
                                                        >
                                                            {formatShortcut(shortcut.shortcut).split(' + ').map((k, i) => (
                                                                <kbd 
                                                                    key={i} 
                                                                    className="px-2 py-1 rounded bg-[#27272a] border border-[#3f3f46] text-xs font-mono text-gray-400 min-w-[24px] text-center"
                                                                >
                                                                    {k}
                                                                </kbd>
                                                            ))}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardBody>
            </Card>

            <Card className="bg-[#18181b] border border-[#27272a]">
                <CardBody className="p-4">
                    <div className="flex items-start gap-3 text-sm text-gray-400">
                        <div className="p-1.5 rounded bg-yellow-500/10 text-yellow-500">
                            <Zap size={14} />
                        </div>
                        <div>
                            <p className="font-medium text-gray-300">Tip: Recording Shortcuts</p>
                            <p className="text-xs mt-1">Click on any shortcut, then press your desired key combination. Press Escape to cancel.</p>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}

function KeybindRow({ label, keys }: { label: string, keys: string[] }) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-gray-300">{label}</span>
            <div className="flex gap-1">
                {keys.map((k, i) => (
                    <kbd key={i} className="px-2 py-1 rounded bg-[#27272a] border border-[#3f3f46] text-xs font-mono text-gray-400 min-w-[24px] text-center">
                        {k}
                    </kbd>
                ))}
            </div>
        </div>
    )
}
