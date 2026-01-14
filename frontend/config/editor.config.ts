export interface ZoomConfig {
    MIN: number;
    MAX: number;
    SENSITIVITY: number;
}

export interface GridConfig {
    SIZE: number;
    SNAP_RADIUS: number;
}

export interface CanvasConfig {
    DEBOUNCE_MS: number;
    NODE_WIDTH: number;
    NODE_HEIGHT: number;
    MOVE_STEP: number;
}

export interface ShortcutsConfig {
    DELETE: string[];
}

export const EDITOR_CONFIG = {
    ZOOM: {
        MIN: Number(process.env.NEXT_PUBLIC_EDITOR_MIN_ZOOM) || 0.1,
        MAX: Number(process.env.NEXT_PUBLIC_EDITOR_MAX_ZOOM) || 2,
        SENSITIVITY: 0.001,
    } as ZoomConfig,
    GRID: {
        SIZE: 20,
        SNAP_RADIUS: 40,
    } as GridConfig,
    CANVAS: {
        DEBOUNCE_MS: 2000,
        NODE_WIDTH: 200,
        NODE_HEIGHT: 100,
        MOVE_STEP: 10,
    } as CanvasConfig,
    SHORTCUTS: {
        DELETE: ['Delete', 'Backspace'],
    } as ShortcutsConfig,
};
