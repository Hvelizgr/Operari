/**
 * Hook for Blast Radius functionality
 * Highlights downstream/upstream nodes when a node is selected in impact mode
 */

import { useState, useCallback, useMemo } from 'react';
import type { Connection } from '@nanoflow/shared';
import {
    calculateBlastRadius,
    getBlastRadiusConnections,
    BlastRadiusResult,
} from '../utils/blastRadius';

export type BlastRadiusMode = 'off' | 'downstream' | 'upstream' | 'both';

interface UseBlastRadiusOptions {
    connections: Connection[];
}

interface UseBlastRadiusReturn {
    // State
    blastRadiusMode: BlastRadiusMode;
    focusedNodeId: string | null;
    blastRadius: BlastRadiusResult | null;
    affectedConnections: Set<string>;

    // Actions
    setBlastRadiusMode: (mode: BlastRadiusMode) => void;
    setFocusedNode: (nodeId: string | null) => void;
    toggleBlastRadiusMode: () => void;

    // Helpers
    isNodeInBlastRadius: (nodeId: string) => boolean;
    isNodeDimmed: (nodeId: string) => boolean;
    isConnectionInBlastRadius: (connectionId: string) => boolean;
    getNodeBlastRadiusStyle: (nodeId: string) => 'focused' | 'affected' | 'dimmed' | 'normal';
}

export function useBlastRadius({ connections }: UseBlastRadiusOptions): UseBlastRadiusReturn {
    const [blastRadiusMode, setBlastRadiusMode] = useState<BlastRadiusMode>('off');
    const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

    // Calculate blast radius when focused node changes
    const blastRadius = useMemo(() => {
        if (!focusedNodeId || blastRadiusMode === 'off') return null;
        return calculateBlastRadius(focusedNodeId, connections);
    }, [focusedNodeId, connections, blastRadiusMode]);

    // Get affected connections
    const affectedConnections = useMemo(() => {
        if (!focusedNodeId || blastRadiusMode === 'off') return new Set<string>();

        const direction = blastRadiusMode === 'both' ? 'both' :
            blastRadiusMode === 'downstream' ? 'downstream' : 'upstream';

        return getBlastRadiusConnections(focusedNodeId, connections, direction);
    }, [focusedNodeId, connections, blastRadiusMode]);

    // Set focused node for blast radius
    const setFocusedNode = useCallback((nodeId: string | null) => {
        setFocusedNodeId(nodeId);
    }, []);

    // Toggle through blast radius modes
    const toggleBlastRadiusMode = useCallback(() => {
        setBlastRadiusMode(prev => {
            const modes: BlastRadiusMode[] = ['off', 'downstream', 'upstream', 'both'];
            const currentIndex = modes.indexOf(prev);
            return modes[(currentIndex + 1) % modes.length];
        });
    }, []);

    // Check if node is in blast radius
    const isNodeInBlastRadius = useCallback((nodeId: string): boolean => {
        if (!blastRadius || blastRadiusMode === 'off') return false;
        if (nodeId === focusedNodeId) return true;

        if (blastRadiusMode === 'downstream') {
            return blastRadius.downstream.has(nodeId);
        } else if (blastRadiusMode === 'upstream') {
            return blastRadius.upstream.has(nodeId);
        } else {
            return blastRadius.downstream.has(nodeId) || blastRadius.upstream.has(nodeId);
        }
    }, [blastRadius, blastRadiusMode, focusedNodeId]);

    // Check if node should be dimmed
    const isNodeDimmed = useCallback((nodeId: string): boolean => {
        if (blastRadiusMode === 'off' || !focusedNodeId) return false;
        return !isNodeInBlastRadius(nodeId);
    }, [blastRadiusMode, focusedNodeId, isNodeInBlastRadius]);

    // Check if connection is in blast radius
    const isConnectionInBlastRadius = useCallback((connectionId: string): boolean => {
        return affectedConnections.has(connectionId);
    }, [affectedConnections]);

    // Get visual style for a node in blast radius mode
    const getNodeBlastRadiusStyle = useCallback((nodeId: string): 'focused' | 'affected' | 'dimmed' | 'normal' => {
        if (blastRadiusMode === 'off' || !focusedNodeId) return 'normal';

        if (nodeId === focusedNodeId) return 'focused';
        if (isNodeInBlastRadius(nodeId)) return 'affected';
        return 'dimmed';
    }, [blastRadiusMode, focusedNodeId, isNodeInBlastRadius]);

    return {
        blastRadiusMode,
        focusedNodeId,
        blastRadius,
        affectedConnections,
        setBlastRadiusMode,
        setFocusedNode,
        toggleBlastRadiusMode,
        isNodeInBlastRadius,
        isNodeDimmed,
        isConnectionInBlastRadius,
        getNodeBlastRadiusStyle,
    };
}
