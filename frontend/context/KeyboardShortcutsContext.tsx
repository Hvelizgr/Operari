'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ShortcutAction =
    | 'undo'
    | 'redo'
    | 'delete'
    | 'duplicate'
    | 'copy'
    | 'cut'
    | 'paste'
    | 'toggleEnable'
    | 'selectAll'
    | 'deselect'
    | 'runWorkflow'
    | 'save'
    | 'openNodePanel'
    | 'openCommandPalette'
    | 'zoomIn'
    | 'zoomOut'
    | 'zoomReset'
    | 'fitView';

export interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
}

export interface ShortcutDefinition {
    action: ShortcutAction;
    shortcut: ShortcutConfig;
    label: { en: string; es: string };
    category: 'general' | 'nodes' | 'navigation' | 'execution' | 'selection';
}

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
    { action: 'undo', shortcut: { key: 'z', ctrl: true }, label: { en: 'Undo', es: 'Deshacer' }, category: 'general' },
    { action: 'redo', shortcut: { key: 'z', ctrl: true, shift: true }, label: { en: 'Redo', es: 'Rehacer' }, category: 'general' },
    { action: 'save', shortcut: { key: 's', ctrl: true }, label: { en: 'Save', es: 'Guardar' }, category: 'general' },
    { action: 'openCommandPalette', shortcut: { key: 'k', ctrl: true }, label: { en: 'Command Palette', es: 'Paleta de Comandos' }, category: 'general' },
    
    { action: 'delete', shortcut: { key: 'Delete' }, label: { en: 'Delete Selected', es: 'Eliminar Selección' }, category: 'nodes' },
    { action: 'duplicate', shortcut: { key: 'd', ctrl: true }, label: { en: 'Duplicate', es: 'Duplicar' }, category: 'nodes' },
    { action: 'copy', shortcut: { key: 'c', ctrl: true }, label: { en: 'Copy', es: 'Copiar' }, category: 'nodes' },
    { action: 'cut', shortcut: { key: 'x', ctrl: true }, label: { en: 'Cut', es: 'Cortar' }, category: 'nodes' },
    { action: 'paste', shortcut: { key: 'v', ctrl: true }, label: { en: 'Paste', es: 'Pegar' }, category: 'nodes' },
    { action: 'toggleEnable', shortcut: { key: 'e', ctrl: true }, label: { en: 'Toggle Enable', es: 'Activar/Desactivar' }, category: 'nodes' },
    { action: 'openNodePanel', shortcut: { key: 'n', ctrl: true }, label: { en: 'Add Node', es: 'Añadir Nodo' }, category: 'nodes' },

    { action: 'selectAll', shortcut: { key: 'a', ctrl: true }, label: { en: 'Select All', es: 'Seleccionar Todo' }, category: 'selection' },
    { action: 'deselect', shortcut: { key: 'Escape' }, label: { en: 'Deselect All', es: 'Deseleccionar Todo' }, category: 'selection' },

    { action: 'zoomIn', shortcut: { key: '=', ctrl: true }, label: { en: 'Zoom In', es: 'Acercar' }, category: 'navigation' },
    { action: 'zoomOut', shortcut: { key: '-', ctrl: true }, label: { en: 'Zoom Out', es: 'Alejar' }, category: 'navigation' },
    { action: 'zoomReset', shortcut: { key: '0', ctrl: true }, label: { en: 'Reset Zoom', es: 'Restablecer Zoom' }, category: 'navigation' },
    { action: 'fitView', shortcut: { key: '1', ctrl: true }, label: { en: 'Fit View', es: 'Ajustar Vista' }, category: 'navigation' },

    { action: 'runWorkflow', shortcut: { key: 'Enter', ctrl: true }, label: { en: 'Run Workflow', es: 'Ejecutar Flujo' }, category: 'execution' },
];

export const CATEGORY_LABELS = {
    general: { en: 'General', es: 'General' },
    nodes: { en: 'Node Management', es: 'Gestión de Nodos' },
    navigation: { en: 'Navigation', es: 'Navegación' },
    execution: { en: 'Execution', es: 'Ejecución' },
    selection: { en: 'Selection', es: 'Selección' },
};

interface KeyboardShortcutsContextType {
    shortcuts: ShortcutDefinition[];
    updateShortcut: (action: ShortcutAction, newShortcut: ShortcutConfig) => void;
    resetToDefaults: () => void;
    getShortcut: (action: ShortcutAction) => ShortcutDefinition | undefined;
    formatShortcut: (shortcut: ShortcutConfig) => string;
    matchesShortcut: (e: KeyboardEvent, action: ShortcutAction) => boolean;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

const STORAGE_KEY = 'nanoflow-keyboard-shortcuts';

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
    const [shortcuts, setShortcuts] = useState<ShortcutDefinition[]>(DEFAULT_SHORTCUTS);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as ShortcutDefinition[];
                const merged = DEFAULT_SHORTCUTS.map(def => {
                    const storedDef = parsed.find(s => s.action === def.action);
                    return storedDef ? { ...def, shortcut: storedDef.shortcut } : def;
                });
                setShortcuts(merged);
            } catch {
                setShortcuts(DEFAULT_SHORTCUTS);
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    }, [shortcuts]);

    const updateShortcut = (action: ShortcutAction, newShortcut: ShortcutConfig) => {
        setShortcuts(prev => prev.map(s => 
            s.action === action ? { ...s, shortcut: newShortcut } : s
        ));
    };

    const resetToDefaults = () => {
        setShortcuts(DEFAULT_SHORTCUTS);
    };

    const getShortcut = (action: ShortcutAction) => {
        return shortcuts.find(s => s.action === action);
    };

    const formatShortcut = (shortcut: ShortcutConfig): string => {
        const parts: string[] = [];
        if (shortcut.ctrl) parts.push('Ctrl');
        if (shortcut.alt) parts.push('Alt');
        if (shortcut.shift) parts.push('Shift');
        if (shortcut.meta) parts.push('⌘');
        
        let key = shortcut.key;
        if (key === ' ') key = 'Space';
        else if (key === 'ArrowUp') key = '↑';
        else if (key === 'ArrowDown') key = '↓';
        else if (key === 'ArrowLeft') key = '←';
        else if (key === 'ArrowRight') key = '→';
        else if (key.length === 1) key = key.toUpperCase();
        
        parts.push(key);
        return parts.join(' + ');
    };

    const matchesShortcut = (e: KeyboardEvent, action: ShortcutAction): boolean => {
        const def = getShortcut(action);
        if (!def) return false;
        
        const { shortcut } = def;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase() || e.key === shortcut.key;
        const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
        const shiftMatch = !!shortcut.shift === e.shiftKey;
        const altMatch = !!shortcut.alt === e.altKey;
        
        return keyMatch && ctrlMatch && shiftMatch && altMatch;
    };

    return (
        <KeyboardShortcutsContext.Provider value={{
            shortcuts,
            updateShortcut,
            resetToDefaults,
            getShortcut,
            formatShortcut,
            matchesShortcut,
        }}>
            {children}
        </KeyboardShortcutsContext.Provider>
    );
}

export function useKeyboardShortcuts() {
    const context = useContext(KeyboardShortcutsContext);
    if (!context) {
        throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
    }
    return context;
}
