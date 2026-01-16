import { useState, useCallback, useRef, useEffect } from 'react';
import type { WorkflowNode } from '@nanoflow/shared';
import type { ViewportState } from '../types/editor.types';

export type PortType = 'input' | 'output' | 'up' | 'down';
export type Direction = 'left' | 'right' | 'top' | 'bottom';

export interface SolderState {
    startNodeId: string;
    startPort: PortType;
    endPort: PortType;
    startDir: Direction;
    endDir: Direction;
    mousePos: { x: number; y: number };
}

interface UseEditorSolderingProps {
    canvasRef: React.RefObject<HTMLDivElement | null>;
    viewport: ViewportState;
    nodes: WorkflowNode[];
    onConnectionComplete: (sourceId: string, targetId: string) => void;
    isDrawMode: boolean;
}

export function useEditorSoldering({
    canvasRef,
    viewport,
    nodes,
    onConnectionComplete,
    isDrawMode
}: UseEditorSolderingProps) {
    const [soldering, setSoldering] = useState<SolderState | null>(null);
    const [pausedSolder, setPausedSolder] = useState<SolderState | null>(null);

    // Direction map like xyOps (lines 896-903)
    const getDirMap = useCallback((port: PortType) => {
        const dirMap = {
            output: { startDir: 'right' as Direction, endDir: 'left' as Direction, endPort: 'input' as PortType },
            input: { startDir: 'left' as Direction, endDir: 'right' as Direction, endPort: 'output' as PortType },
            down: { startDir: 'bottom' as Direction, endDir: 'top' as Direction, endPort: 'up' as PortType },
            up: { startDir: 'top' as Direction, endDir: 'bottom' as Direction, endPort: 'down' as PortType }
        };
        return dirMap[port];
    }, []);

    // Start solder (xyOps lines 905-910)
    const startSolder = useCallback((nodeId: string, port: PortType, initialX?: number, initialY?: number) => {
        const config = getDirMap(port);

        let mouseX = 0, mouseY = 0;
        if (initialX !== undefined && initialY !== undefined && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            mouseX = initialX - rect.left;
            mouseY = initialY - rect.top;
        }

        setSoldering({
            startNodeId: nodeId,
            startPort: port,
            endPort: config.endPort,
            startDir: config.startDir,
            endDir: config.endDir,
            mousePos: { x: mouseX, y: mouseY }
        });

        if (canvasRef.current) {
            canvasRef.current.classList.add('dragging');
        }
    }, [isDrawMode, getDirMap, canvasRef]);

    // Update mouse position (xyOps lines 944-950)
    const updateSolderPosition = useCallback((clientX: number, clientY: number) => {
        if (!soldering || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        setSoldering(prev => prev ? { ...prev, mousePos: { x, y } } : null);
    }, [soldering, canvasRef]);

    // Complete solder (xyOps lines 1169-1227)
    const completeSolder = useCallback((targetNodeId: string) => {
        if (!soldering) return;

        if (soldering.startNodeId === targetNodeId) {
            cancelSolder();
            return;
        }

        let sourceId = soldering.startNodeId;
        let destId = targetNodeId;
        if (soldering.startPort === 'input' || soldering.startPort === 'up') {
            [sourceId, destId] = [destId, sourceId];
        }

        onConnectionComplete(sourceId, destId);

        if (canvasRef.current) {
            canvasRef.current.classList.remove('dragging');
        }
        setSoldering(null);
    }, [soldering, onConnectionComplete, canvasRef]);

    // Cancel solder (xyOps lines 990-1007)
    const cancelSolder = useCallback(() => {
        if (!soldering && !pausedSolder) return;

        if (canvasRef.current) {
            canvasRef.current.classList.remove('dragging');
        }
        setSoldering(null);
        setPausedSolder(null);
    }, [soldering, pausedSolder, canvasRef]);

    // ESC key to cancel (xyOps behavior)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && (soldering || pausedSolder)) {
                e.preventDefault();
                cancelSolder();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [soldering, pausedSolder, cancelSolder]);

    // Pause solder logic (xyOps solderNewNode)
    const pauseSolder = useCallback(() => {
        if (!soldering) return;
        setPausedSolder(soldering);
        setSoldering(null);
        if (canvasRef.current) {
            canvasRef.current.classList.remove('dragging');
        }
    }, [soldering, canvasRef]);

    const resumeSolder = useCallback((targetNodeId: string) => {
        if (!pausedSolder) return;

        let sourceId = pausedSolder.startNodeId;
        let destId = targetNodeId;

        if (pausedSolder.startPort === 'input' || pausedSolder.startPort === 'up') {
            [sourceId, destId] = [destId, sourceId];
        }

        onConnectionComplete(sourceId, destId);
        setPausedSolder(null);
    }, [pausedSolder, onConnectionComplete]);

    return {
        soldering,
        startSolder,
        updateSolderPosition,
        completeSolder,
        cancelSolder,
        isSoldering: !!soldering,
        pauseSolder,
        resumeSolder,
        pausedSolder
    };
}
