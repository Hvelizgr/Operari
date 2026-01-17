'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Map, Minimize2, Maximize2 } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import { WorkflowNode } from '../Editor';

interface MiniMapProps {
    nodes: WorkflowNode[];
    viewport: { x: number; y: number; zoom: number };
    canvasSize: { width: number; height: number };
    onViewportChange: (x: number, y: number) => void;
    lang: 'en' | 'es';
}

export default function MiniMap({ nodes, viewport, canvasSize, onViewportChange, lang }: MiniMapProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const miniMapRef = useRef<HTMLDivElement>(null);

    const MINIMAP_WIDTH = 240;
    const MINIMAP_HEIGHT = 180;
    const SCALE = 0.1;

    const content = {
        en: {
            minimap: 'Mini Map',
            collapse: 'Collapse',
            expand: 'Expand',
        },
        es: {
            minimap: 'Mini Mapa',
            collapse: 'Contraer',
            expand: 'Expandir',
        },
    };

    const text = content[lang] || content['en'];

    const calculateBounds = () => {
        if (nodes.length === 0) {
            return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + 200);
            maxY = Math.max(maxY, node.position.y + 100);
        });

        const padding = 200;
        return {
            minX: minX - padding,
            minY: minY - padding,
            maxX: maxX + padding,
            maxY: maxY + padding,
        };
    };

    const bounds = calculateBounds();
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;

    const scaleX = MINIMAP_WIDTH / worldWidth;
    const scaleY = MINIMAP_HEIGHT / worldHeight;
    const scale = Math.min(scaleX, scaleY);

    const toMiniMapCoords = (x: number, y: number) => ({
        x: (x - bounds.minX) * scale,
        y: (y - bounds.minY) * scale,
    });

    const fromMiniMapCoords = (x: number, y: number) => ({
        x: x / scale + bounds.minX,
        y: y / scale + bounds.minY,
    });

    const viewportInWorld = {
        x: -viewport.x / viewport.zoom,
        y: -viewport.y / viewport.zoom,
        width: canvasSize.width / viewport.zoom,
        height: canvasSize.height / viewport.zoom,
    };

    const viewportInMiniMap = {
        x: (viewportInWorld.x - bounds.minX) * scale,
        y: (viewportInWorld.y - bounds.minY) * scale,
        width: viewportInWorld.width * scale,
        height: viewportInWorld.height * scale,
    };

    const handleMiniMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!miniMapRef.current) return;

        const rect = miniMapRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const worldCoords = fromMiniMapCoords(clickX, clickY);

        const newX = -(worldCoords.x - canvasSize.width / viewport.zoom / 2) * viewport.zoom;
        const newY = -(worldCoords.y - canvasSize.height / viewport.zoom / 2) * viewport.zoom;

        onViewportChange(newX, newY);
    }, [bounds, scale, viewport.zoom, canvasSize, onViewportChange]);

    const handleViewportDragStart = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleViewportDrag = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !miniMapRef.current) return;

        const rect = miniMapRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const worldCoords = fromMiniMapCoords(clickX, clickY);

        const newX = -(worldCoords.x - canvasSize.width / viewport.zoom / 2) * viewport.zoom;
        const newY = -(worldCoords.y - canvasSize.height / viewport.zoom / 2) * viewport.zoom;

        onViewportChange(newX, newY);
    }, [isDragging, bounds, scale, viewport.zoom, canvasSize, onViewportChange]);

    const handleViewportDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    return (
        <motion.div
            className="absolute bottom-4 left-4 z-40"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
        >
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <Map size={14} className="text-blue-500" />
                        <span className="text-xs font-semibold text-slate-200">{text.minimap}</span>
                    </div>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                        title={isCollapsed ? text.expand : text.collapse}
                    >
                        {isCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                    </button>
                </div>

                <AnimatePresence>
                    {!isCollapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div
                                ref={miniMapRef}
                                className="relative bg-slate-950 cursor-pointer"
                                style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
                                role="img"
                                aria-label="Workflow minimap showing an overview of all nodes and current viewport position. Click to navigate."
                                onClick={handleMiniMapClick}
                                onMouseMove={handleViewportDrag}
                                onMouseUp={handleViewportDragEnd}
                                onMouseLeave={handleViewportDragEnd}
                            >
                                {nodes.map(node => {
                                    const miniPos = toMiniMapCoords(node.position.x, node.position.y);
                                    return (
                                        <div
                                            key={node.id}
                                            className="absolute bg-blue-500/40 border border-blue-400/60 rounded-sm"
                                            style={{
                                                left: miniPos.x,
                                                top: miniPos.y,
                                                width: 200 * scale,
                                                height: 100 * scale,
                                            }}
                                        />
                                    );
                                })}

                                <motion.div
                                    className="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move"
                                    style={{
                                        left: Math.max(0, Math.min(MINIMAP_WIDTH - viewportInMiniMap.width, viewportInMiniMap.x)),
                                        top: Math.max(0, Math.min(MINIMAP_HEIGHT - viewportInMiniMap.height, viewportInMiniMap.y)),
                                        width: Math.min(MINIMAP_WIDTH, viewportInMiniMap.width),
                                        height: Math.min(MINIMAP_HEIGHT, viewportInMiniMap.height),
                                    }}
                                    onMouseDown={handleViewportDragStart}
                                    animate={{
                                        left: Math.max(0, Math.min(MINIMAP_WIDTH - viewportInMiniMap.width, viewportInMiniMap.x)),
                                        top: Math.max(0, Math.min(MINIMAP_HEIGHT - viewportInMiniMap.height, viewportInMiniMap.y)),
                                    }}
                                    transition={{ type: 'tween', duration: 0.1 }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
