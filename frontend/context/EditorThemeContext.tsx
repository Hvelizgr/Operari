'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type EditorTheme = 
    | 'default-dark' 
    | 'neon-cyber' 
    | 'forest-natural' 
    | 'ocean-blue' 
    | 'sunset-warm'
    | 'midnight-purple'
    | 'arctic-frost'
    | 'volcanic-red';

export type NodeStyle = 
    | 'n8n-classic' 
    | 'rounded-pill' 
    | 'sharp-square' 
    | 'diamond' 
    | 'hexagon'
    | 'circle'
    | 'parallelogram'
    | 'stadium';

export type TriggerNodeStyle = 
    | 'diamond-classic'
    | 'circle-pulse'
    | 'lightning-bolt'
    | 'radar'
    | 'beacon';

export type ActionNodeStyle = 
    | 'rectangle-default'
    | 'rounded-action'
    | 'card-elevated'
    | 'minimal-flat'
    | 'gradient-glass';

export type ConditionNodeStyle = 
    | 'diamond-branch'
    | 'hexagon-decision'
    | 'circle-split'
    | 'arrow-fork'
    | 'gateway';

export type ConnectionStyle = 
    | 'solid' 
    | 'dashed' 
    | 'dotted' 
    | 'gradient' 
    | 'animated-flow'
    | 'double-line'
    | 'glow-line'
    | 'rainbow';

export type ConnectionPathStyle =
    | 'bezier'
    | 'step'
    | 'smoothstep'
    | 'straight';

export type FlowAnimation = 
    | 'marching-ants' 
    | 'pulse-glow' 
    | 'particle-flow' 
    | 'wave' 
    | 'electric'
    | 'data-stream'
    | 'heartbeat'
    | 'neon-chase';

export type ConnectionBadgeStyle =
    | 'minimal'
    | 'pill'
    | 'icon-only'
    | 'status-dot'
    | 'label';

export interface EditorThemeConfig {
    theme: EditorTheme;
    nodeStyle: NodeStyle;
    triggerNodeStyle: TriggerNodeStyle;
    actionNodeStyle: ActionNodeStyle;
    conditionNodeStyle: ConditionNodeStyle;
    connectionStyle: ConnectionStyle;
    connectionPathStyle: ConnectionPathStyle;
    flowAnimation: FlowAnimation;
    showConnectionBadges: boolean;
    connectionBadgeStyle: ConnectionBadgeStyle;
    nodeCategoryColors: NodeCategoryColors;
    minimapCollapsed: boolean;
    terminalCollapsed: boolean;
}

export interface ThemeColors {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    border: string;
    text: string;
    textMuted: string;
    success: string;
    error: string;
    warning: string;
    nodeGlow: string;
    edgeColor: string;
    edgeGlow: string;
    primaryGlow: string;
}

export interface NodeCategoryColors {
    triggers: string;
    actions: string;
    logic: string;
    integrations: string;
    ai: string;
    utilities: string;
}

export const DEFAULT_NODE_CATEGORY_COLORS: NodeCategoryColors = {
    triggers: '#f97316',
    actions: '#3b82f6',
    logic: '#a855f7',
    integrations: '#10b981',
    ai: '#ec4899',
    utilities: '#64748b',
};

export const THEME_CONFIGS: Record<EditorTheme, ThemeColors> = {
    'default-dark': {
        primary: '#3b82f6',
        secondary: '#6366f1',
        accent: '#8b5cf6',
        background: '#09090b',
        surface: '#18181b',
        border: 'rgba(255, 255, 255, 0.08)',
        text: '#fafafa',
        textMuted: '#71717a',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        nodeGlow: 'rgba(59, 130, 246, 0.4)',
        edgeColor: '#475569',
        edgeGlow: 'rgba(71, 85, 105, 0.2)',
        primaryGlow: 'rgba(59, 130, 246, 0.3)',
    },
    'neon-cyber': {
        primary: '#00ffff',
        secondary: '#ff00ff',
        accent: '#00ff00',
        background: '#0a0a0f',
        surface: '#12121a',
        border: 'rgba(0, 255, 255, 0.15)',
        text: '#ffffff',
        textMuted: '#888899',
        success: '#00ff88',
        error: '#ff3366',
        warning: '#ffcc00',
        nodeGlow: 'rgba(0, 255, 255, 0.5)',
        edgeColor: '#00ffff',
        edgeGlow: 'rgba(0, 255, 255, 0.3)',
        primaryGlow: 'rgba(0, 255, 255, 0.4)',
    },
    'forest-natural': {
        primary: '#22c55e',
        secondary: '#84cc16',
        accent: '#a3e635',
        background: '#0c1a0f',
        surface: '#142318',
        border: 'rgba(34, 197, 94, 0.15)',
        text: '#ecfdf5',
        textMuted: '#6b8a70',
        success: '#4ade80',
        error: '#f87171',
        warning: '#fbbf24',
        nodeGlow: 'rgba(34, 197, 94, 0.4)',
        edgeColor: '#22c55e',
        edgeGlow: 'rgba(34, 197, 94, 0.3)',
        primaryGlow: 'rgba(34, 197, 94, 0.4)',
    },
    'ocean-blue': {
        primary: '#0ea5e9',
        secondary: '#06b6d4',
        accent: '#38bdf8',
        background: '#0a1628',
        surface: '#0f2035',
        border: 'rgba(14, 165, 233, 0.15)',
        text: '#f0f9ff',
        textMuted: '#7dd3fc',
        success: '#34d399',
        error: '#fb7185',
        warning: '#fcd34d',
        nodeGlow: 'rgba(14, 165, 233, 0.4)',
        edgeColor: '#0ea5e9',
        edgeGlow: 'rgba(14, 165, 233, 0.3)',
        primaryGlow: 'rgba(14, 165, 233, 0.4)',
    },
    'sunset-warm': {
        primary: '#f97316',
        secondary: '#f43f5e',
        accent: '#fbbf24',
        background: '#1a0f0a',
        surface: '#251810',
        border: 'rgba(249, 115, 22, 0.15)',
        text: '#fff7ed',
        textMuted: '#fdba74',
        success: '#a3e635',
        error: '#ef4444',
        warning: '#facc15',
        nodeGlow: 'rgba(249, 115, 22, 0.4)',
        edgeColor: '#f97316',
        edgeGlow: 'rgba(249, 115, 22, 0.3)',
        primaryGlow: 'rgba(249, 115, 22, 0.4)',
    },
    'midnight-purple': {
        primary: '#a855f7',
        secondary: '#7c3aed',
        accent: '#c084fc',
        background: '#0f0a1a',
        surface: '#1a1025',
        border: 'rgba(168, 85, 247, 0.15)',
        text: '#faf5ff',
        textMuted: '#a78bfa',
        success: '#34d399',
        error: '#f87171',
        warning: '#fbbf24',
        nodeGlow: 'rgba(168, 85, 247, 0.4)',
        edgeColor: '#a855f7',
        edgeGlow: 'rgba(168, 85, 247, 0.3)',
        primaryGlow: 'rgba(168, 85, 247, 0.4)',
    },
    'arctic-frost': {
        primary: '#67e8f9',
        secondary: '#a5f3fc',
        accent: '#22d3ee',
        background: '#0c1929',
        surface: '#132337',
        border: 'rgba(103, 232, 249, 0.12)',
        text: '#ecfeff',
        textMuted: '#a5f3fc',
        success: '#4ade80',
        error: '#fb7185',
        warning: '#fcd34d',
        nodeGlow: 'rgba(103, 232, 249, 0.35)',
        edgeColor: '#67e8f9',
        edgeGlow: 'rgba(103, 232, 249, 0.3)',
        primaryGlow: 'rgba(103, 232, 249, 0.4)',
    },
    'volcanic-red': {
        primary: '#ef4444',
        secondary: '#dc2626',
        accent: '#f97316',
        background: '#1a0a0a',
        surface: '#251212',
        border: 'rgba(239, 68, 68, 0.15)',
        text: '#fef2f2',
        textMuted: '#fca5a5',
        success: '#84cc16',
        error: '#f87171',
        warning: '#fbbf24',
        nodeGlow: 'rgba(239, 68, 68, 0.4)',
        edgeColor: '#ef4444',
        edgeGlow: 'rgba(239, 68, 68, 0.3)',
        primaryGlow: 'rgba(239, 68, 68, 0.4)',
    },
};

export const THEME_LABELS: Record<EditorTheme, string> = {
    'default-dark': 'Default Dark',
    'neon-cyber': 'Neon Cyber',
    'forest-natural': 'Forest Natural',
    'ocean-blue': 'Ocean Blue',
    'sunset-warm': 'Sunset Warm',
    'midnight-purple': 'Midnight Purple',
    'arctic-frost': 'Arctic Frost',
    'volcanic-red': 'Volcanic Red',
};

export const NODE_STYLE_LABELS: Record<NodeStyle, string> = {
    'n8n-classic': 'n8n Classic',
    'rounded-pill': 'Rounded Pill',
    'sharp-square': 'Sharp Square',
    'diamond': 'Diamond',
    'hexagon': 'Hexagon',
    'circle': 'Circle',
    'parallelogram': 'Parallelogram',
    'stadium': 'Stadium',
};

export const TRIGGER_NODE_STYLE_LABELS: Record<TriggerNodeStyle, string> = {
    'diamond-classic': 'Diamond Classic',
    'circle-pulse': 'Circle Pulse',
    'lightning-bolt': 'Lightning Bolt',
    'radar': 'Radar Scan',
    'beacon': 'Beacon Signal',
};

export const ACTION_NODE_STYLE_LABELS: Record<ActionNodeStyle, string> = {
    'rectangle-default': 'Rectangle Default',
    'rounded-action': 'Rounded Action',
    'card-elevated': 'Card Elevated',
    'minimal-flat': 'Minimal Flat',
    'gradient-glass': 'Gradient Glass',
};

export const CONDITION_NODE_STYLE_LABELS: Record<ConditionNodeStyle, string> = {
    'diamond-branch': 'Diamond Branch',
    'hexagon-decision': 'Hexagon Decision',
    'circle-split': 'Circle Split',
    'arrow-fork': 'Arrow Fork',
    'gateway': 'Gateway',
};

export const CONNECTION_STYLE_LABELS: Record<ConnectionStyle, string> = {
    'solid': 'Solid',
    'dashed': 'Dashed',
    'dotted': 'Dotted',
    'gradient': 'Gradient',
    'animated-flow': 'Animated Flow',
    'double-line': 'Double Line',
    'glow-line': 'Glow Line',
    'rainbow': 'Rainbow',
};

export const CONNECTION_PATH_STYLE_LABELS: Record<ConnectionPathStyle, string> = {
    'bezier': 'Bezier (Curva suave)',
    'step': 'Step (Cuadrada n8n)',
    'smoothstep': 'Smooth Step (Semi-cuadrada)',
    'straight': 'Straight (Recta)',
};

export const FLOW_ANIMATION_LABELS: Record<FlowAnimation, string> = {
    'marching-ants': 'Marching Ants',
    'pulse-glow': 'Pulse Glow',
    'particle-flow': 'Particle Flow',
    'wave': 'Wave',
    'electric': 'Electric',
    'data-stream': 'Data Stream',
    'heartbeat': 'Heartbeat',
    'neon-chase': 'Neon Chase',
};

export const CONNECTION_BADGE_STYLE_LABELS: Record<ConnectionBadgeStyle, string> = {
    'minimal': 'Minimal (Círculo)',
    'pill': 'Pill (Etiqueta completa)',
    'icon-only': 'Solo Icono (Cuadrado)',
    'status-dot': 'Punto de Estado',
    'label': 'Con Tooltip',
};

interface EditorThemeContextType {
    config: EditorThemeConfig;
    colors: ThemeColors;
    setTheme: (theme: EditorTheme) => void;
    setNodeStyle: (style: NodeStyle) => void;
    setTriggerNodeStyle: (style: TriggerNodeStyle) => void;
    setActionNodeStyle: (style: ActionNodeStyle) => void;
    setConditionNodeStyle: (style: ConditionNodeStyle) => void;
    setConnectionStyle: (style: ConnectionStyle) => void;
    setConnectionPathStyle: (style: ConnectionPathStyle) => void;
    setFlowAnimation: (animation: FlowAnimation) => void;
    setShowConnectionBadges: (show: boolean) => void;
    setConnectionBadgeStyle: (style: ConnectionBadgeStyle) => void;
    setNodeCategoryColor: (category: keyof NodeCategoryColors, color: string) => void;
    setMinimapCollapsed: (collapsed: boolean) => void;
    setTerminalCollapsed: (collapsed: boolean) => void;
    resetToDefaults: () => void;
    getNodeColorByCategory: (category: string) => string;
}

const DEFAULT_CONFIG: EditorThemeConfig = {
    theme: 'default-dark',
    nodeStyle: 'n8n-classic',
    triggerNodeStyle: 'diamond-classic',
    actionNodeStyle: 'rectangle-default',
    conditionNodeStyle: 'diamond-branch',
    connectionStyle: 'solid',
    connectionPathStyle: 'bezier',
    flowAnimation: 'marching-ants',
    showConnectionBadges: true,
    connectionBadgeStyle: 'minimal',
    nodeCategoryColors: { ...DEFAULT_NODE_CATEGORY_COLORS },
    minimapCollapsed: true,
    terminalCollapsed: true,
};

const EditorThemeContext = createContext<EditorThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'nanoflow-editor-theme';

export function EditorThemeProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<EditorThemeConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setConfig({ 
                    ...DEFAULT_CONFIG, 
                    ...parsed,
                    nodeCategoryColors: {
                        ...DEFAULT_NODE_CATEGORY_COLORS,
                        ...(parsed.nodeCategoryColors || {})
                    }
                });
            } catch {
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        const colors = THEME_CONFIGS[config.theme];
        const root = document.documentElement;
        root.style.setProperty('--editor-primary', colors.primary);
        root.style.setProperty('--editor-secondary', colors.secondary);
        root.style.setProperty('--editor-accent', colors.accent);
        root.style.setProperty('--editor-background', colors.background);
        root.style.setProperty('--editor-surface', colors.surface);
        root.style.setProperty('--editor-border', colors.border);
        root.style.setProperty('--editor-text', colors.text);
        root.style.setProperty('--editor-text-muted', colors.textMuted);
        root.style.setProperty('--editor-success', colors.success);
        root.style.setProperty('--editor-error', colors.error);
        root.style.setProperty('--editor-warning', colors.warning);
        root.style.setProperty('--editor-node-glow', colors.nodeGlow);
        root.style.setProperty('--editor-edge-color', colors.edgeColor);
        root.style.setProperty('--editor-edge-glow', colors.edgeGlow);
        root.style.setProperty('--editor-primary-glow', colors.primaryGlow);
        root.style.setProperty('--node-color-triggers', config.nodeCategoryColors.triggers);
        root.style.setProperty('--node-color-actions', config.nodeCategoryColors.actions);
        root.style.setProperty('--node-color-logic', config.nodeCategoryColors.logic);
        root.style.setProperty('--node-color-integrations', config.nodeCategoryColors.integrations);
        root.style.setProperty('--node-color-ai', config.nodeCategoryColors.ai);
        root.style.setProperty('--node-color-utilities', config.nodeCategoryColors.utilities);
        root.setAttribute('data-editor-theme', config.theme);
        root.setAttribute('data-node-style', config.nodeStyle);
        root.setAttribute('data-trigger-style', config.triggerNodeStyle);
        root.setAttribute('data-action-style', config.actionNodeStyle);
        root.setAttribute('data-condition-style', config.conditionNodeStyle);
        root.setAttribute('data-connection-style', config.connectionStyle);
        root.setAttribute('data-connection-path-style', config.connectionPathStyle);
        root.setAttribute('data-flow-animation', config.flowAnimation);
    }, [config]);

    const setTheme = (theme: EditorTheme) => setConfig(prev => ({ ...prev, theme }));
    const setNodeStyle = (nodeStyle: NodeStyle) => setConfig(prev => ({ ...prev, nodeStyle }));
    const setTriggerNodeStyle = (triggerNodeStyle: TriggerNodeStyle) => setConfig(prev => ({ ...prev, triggerNodeStyle }));
    const setActionNodeStyle = (actionNodeStyle: ActionNodeStyle) => setConfig(prev => ({ ...prev, actionNodeStyle }));
    const setConditionNodeStyle = (conditionNodeStyle: ConditionNodeStyle) => setConfig(prev => ({ ...prev, conditionNodeStyle }));
    const setConnectionStyle = (connectionStyle: ConnectionStyle) => setConfig(prev => ({ ...prev, connectionStyle }));
    const setConnectionPathStyle = (connectionPathStyle: ConnectionPathStyle) => setConfig(prev => ({ ...prev, connectionPathStyle }));
    const setFlowAnimation = (flowAnimation: FlowAnimation) => setConfig(prev => ({ ...prev, flowAnimation }));
    const setShowConnectionBadges = (showConnectionBadges: boolean) => setConfig(prev => ({ ...prev, showConnectionBadges }));
    const setConnectionBadgeStyle = (connectionBadgeStyle: ConnectionBadgeStyle) => setConfig(prev => ({ ...prev, connectionBadgeStyle }));
    const setMinimapCollapsed = (minimapCollapsed: boolean) => setConfig(prev => ({ ...prev, minimapCollapsed }));
    const setTerminalCollapsed = (terminalCollapsed: boolean) => setConfig(prev => ({ ...prev, terminalCollapsed }));
    const setNodeCategoryColor = (category: keyof NodeCategoryColors, color: string) => 
        setConfig(prev => ({ 
            ...prev, 
            nodeCategoryColors: { ...prev.nodeCategoryColors, [category]: color } 
        }));
    const getNodeColorByCategory = (category: string): string => {
        const cat = category.toLowerCase();
        if (cat.includes('trigger')) return config.nodeCategoryColors.triggers;
        if (cat.includes('action')) return config.nodeCategoryColors.actions;
        if (cat.includes('logic') || cat.includes('flow') || cat.includes('condition')) return config.nodeCategoryColors.logic;
        if (cat.includes('ai') || cat.includes('llm') || cat.includes('openai') || cat.includes('anthropic')) return config.nodeCategoryColors.ai;
        if (cat.includes('util')) return config.nodeCategoryColors.utilities;
        return config.nodeCategoryColors.integrations;
    };
    const resetToDefaults = () => setConfig(DEFAULT_CONFIG);

    const colors = THEME_CONFIGS[config.theme];

    return (
        <EditorThemeContext.Provider value={{
            config,
            colors,
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
            resetToDefaults,
            getNodeColorByCategory,
        }}>
            {children}
        </EditorThemeContext.Provider>
    );
}

export function useEditorTheme() {
    const context = useContext(EditorThemeContext);
    if (!context) {
        throw new Error('useEditorTheme must be used within EditorThemeProvider');
    }
    return context;
}

export function useEditorThemeOptional() {
    return useContext(EditorThemeContext);
}

export function getNodeColorByCategory(category: string, nodeCategoryColors?: NodeCategoryColors): string {
    const colors = nodeCategoryColors || DEFAULT_NODE_CATEGORY_COLORS;
    const cat = category.toLowerCase();
    if (cat.includes('trigger')) return colors.triggers;
    if (cat.includes('action')) return colors.actions;
    if (cat.includes('logic') || cat.includes('flow') || cat.includes('condition')) return colors.logic;
    if (cat.includes('ai') || cat.includes('llm') || cat.includes('openai') || cat.includes('anthropic')) return colors.ai;
    if (cat.includes('util')) return colors.utilities;
    return colors.integrations;
}
