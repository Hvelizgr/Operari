/**
 * Hook for Data Lineage functionality
 * Analyzes node expressions to detect data dependencies beyond explicit connections
 */

import { useState, useCallback, useMemo } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import {
    parseNodeReferences,
    getCompleteDataLineage,
    getLineageSummary,
    detectCircularDependencies,
    DataLineageResult,
    NodeReference,
} from '../utils/nodeReferenceParser';

export type LineageViewMode = 'off' | 'data-flow' | 'references' | 'combined';

interface UseDataLineageOptions {
    nodes: WorkflowNode[];
    connections: Connection[];
}

interface UseDataLineageReturn {
    // State
    lineageMode: LineageViewMode;
    selectedNodeId: string | null;
    lineageResult: DataLineageResult | null;

    // Computed data
    dataDependencies: Set<string>;      // Nodes that selected node reads from
    dataDependents: Set<string>;        // Nodes that read from selected node
    nodeReferences: NodeReference[];     // All references from selected node
    unresolvedReferences: NodeReference[]; // References to missing nodes
    circularDependencies: string[][];    // Detected cycles

    // Summary
    summary: {
        totalReferences: number;
        unresolvedCount: number;
        nodesWithReferences: number;
        mostReferencedNode: { id: string; title: string; count: number } | null;
        hasCircularDeps: boolean;
    };

    // Actions
    setLineageMode: (mode: LineageViewMode) => void;
    setSelectedNode: (nodeId: string | null) => void;
    toggleLineageMode: () => void;

    // Helpers
    isNodeDataSource: (nodeId: string) => boolean;     // Is this node a data source for selected?
    isNodeDataConsumer: (nodeId: string) => boolean;   // Does this node consume data from selected?
    isNodeInLineage: (nodeId: string) => boolean;      // Is this node part of the data lineage?
    getNodeLineageStyle: (nodeId: string) => 'selected' | 'source' | 'consumer' | 'both' | 'dimmed' | 'normal';
    getReferencesForNode: (nodeId: string) => NodeReference[];
    hasUnresolvedReferences: (nodeId: string) => boolean;
}

export function useDataLineage({ nodes, connections }: UseDataLineageOptions): UseDataLineageReturn {
    const [lineageMode, setLineageMode] = useState<LineageViewMode>('off');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Parse all references when nodes or connections change
    const lineageResult = useMemo(() => {
        if (lineageMode === 'off') return null;
        return parseNodeReferences(nodes, connections);
    }, [nodes, connections, lineageMode]);

    // Get complete lineage (explicit + implicit)
    const completeLineage = useMemo(() => {
        if (lineageMode === 'off') return null;
        return getCompleteDataLineage(nodes, connections);
    }, [nodes, connections, lineageMode]);

    // Get summary statistics
    const summary = useMemo(() => {
        return getLineageSummary(nodes, connections);
    }, [nodes, connections]);

    // Detect circular dependencies
    const circularDependencies = useMemo(() => {
        if (lineageMode === 'off') return [];
        return detectCircularDependencies(nodes, connections);
    }, [nodes, connections, lineageMode]);

    // Data dependencies for selected node (nodes it reads from)
    const dataDependencies = useMemo((): Set<string> => {
        if (!selectedNodeId || !completeLineage) return new Set<string>();

        if (lineageMode === 'data-flow') {
            // Only explicit connections
            return completeLineage.explicit.get(selectedNodeId) || new Set<string>();
        } else if (lineageMode === 'references') {
            // Only expression references
            return completeLineage.implicit.get(selectedNodeId) || new Set<string>();
        } else {
            // Combined
            return completeLineage.combined.get(selectedNodeId) || new Set<string>();
        }
    }, [selectedNodeId, completeLineage, lineageMode]);

    // Data dependents for selected node (nodes that read from it)
    const dataDependents = useMemo((): Set<string> => {
        if (!selectedNodeId || !lineageResult) return new Set<string>();
        return lineageResult.reverseFlowMap.get(selectedNodeId) || new Set<string>();
    }, [selectedNodeId, lineageResult]);

    // References from selected node
    const nodeReferences = useMemo(() => {
        if (!selectedNodeId || !lineageResult) return [];
        return lineageResult.references.filter(r => r.sourceNodeId === selectedNodeId);
    }, [selectedNodeId, lineageResult]);

    // Unresolved references from selected node
    const unresolvedReferences = useMemo(() => {
        if (!selectedNodeId || !lineageResult) return [];
        return lineageResult.unresolvedReferences.filter(r => r.sourceNodeId === selectedNodeId);
    }, [selectedNodeId, lineageResult]);

    // Actions
    const setSelectedNode = useCallback((nodeId: string | null) => {
        setSelectedNodeId(nodeId);
    }, []);

    const toggleLineageMode = useCallback(() => {
        setLineageMode(prev => {
            const modes: LineageViewMode[] = ['off', 'data-flow', 'references', 'combined'];
            const currentIndex = modes.indexOf(prev);
            return modes[(currentIndex + 1) % modes.length];
        });
    }, []);

    // Helpers
    const isNodeDataSource = useCallback((nodeId: string): boolean => {
        return dataDependencies.has(nodeId);
    }, [dataDependencies]);

    const isNodeDataConsumer = useCallback((nodeId: string): boolean => {
        return dataDependents.has(nodeId);
    }, [dataDependents]);

    const isNodeInLineage = useCallback((nodeId: string): boolean => {
        if (nodeId === selectedNodeId) return true;
        return isNodeDataSource(nodeId) || isNodeDataConsumer(nodeId);
    }, [selectedNodeId, isNodeDataSource, isNodeDataConsumer]);

    const getNodeLineageStyle = useCallback((
        nodeId: string
    ): 'selected' | 'source' | 'consumer' | 'both' | 'dimmed' | 'normal' => {
        if (lineageMode === 'off' || !selectedNodeId) return 'normal';

        if (nodeId === selectedNodeId) return 'selected';

        const isSource = isNodeDataSource(nodeId);
        const isConsumer = isNodeDataConsumer(nodeId);

        if (isSource && isConsumer) return 'both';
        if (isSource) return 'source';
        if (isConsumer) return 'consumer';
        return 'dimmed';
    }, [lineageMode, selectedNodeId, isNodeDataSource, isNodeDataConsumer]);

    const getReferencesForNode = useCallback((nodeId: string): NodeReference[] => {
        if (!lineageResult) return [];
        return lineageResult.references.filter(r => r.sourceNodeId === nodeId);
    }, [lineageResult]);

    const hasUnresolvedReferences = useCallback((nodeId: string): boolean => {
        if (!lineageResult) return false;
        return lineageResult.unresolvedReferences.some(r => r.sourceNodeId === nodeId);
    }, [lineageResult]);

    return {
        // State
        lineageMode,
        selectedNodeId,
        lineageResult,

        // Computed data
        dataDependencies,
        dataDependents,
        nodeReferences,
        unresolvedReferences,
        circularDependencies,

        // Summary
        summary,

        // Actions
        setLineageMode,
        setSelectedNode,
        toggleLineageMode,

        // Helpers
        isNodeDataSource,
        isNodeDataConsumer,
        isNodeInLineage,
        getNodeLineageStyle,
        getReferencesForNode,
        hasUnresolvedReferences,
    };
}
