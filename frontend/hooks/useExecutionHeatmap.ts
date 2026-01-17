/**
 * useExecutionHeatmap - Hook for tracking execution frequency of nodes
 * Creates a visual heatmap showing which nodes are executed most frequently
 */

import { useState, useCallback, useMemo } from 'react';
import { WorkflowNode } from '@nanoflow/shared';

export interface NodeExecutionStats {
    nodeId: string;
    executionCount: number;
    successCount: number;
    failureCount: number;
    avgDuration: number; // ms
    lastExecuted?: Date;
}

export interface HeatmapData {
    stats: Map<string, NodeExecutionStats>;
    maxExecutions: number;
    totalExecutions: number;
}

export type HeatLevel = 'cold' | 'warm' | 'hot' | 'very-hot';

// Heat level colors (CSS variable names)
export const HEAT_COLORS: Record<HeatLevel, string> = {
    'cold': 'rgba(59, 130, 246, 0.2)',      // Blue - rarely executed
    'warm': 'rgba(34, 197, 94, 0.3)',        // Green - sometimes executed
    'hot': 'rgba(249, 115, 22, 0.4)',        // Orange - frequently executed
    'very-hot': 'rgba(239, 68, 68, 0.5)',    // Red - very frequently executed
};

export const HEAT_BORDER_COLORS: Record<HeatLevel, string> = {
    'cold': 'rgba(59, 130, 246, 0.5)',
    'warm': 'rgba(34, 197, 94, 0.6)',
    'hot': 'rgba(249, 115, 22, 0.7)',
    'very-hot': 'rgba(239, 68, 68, 0.8)',
};

interface UseExecutionHeatmapOptions {
    enabled?: boolean;
    decayFactor?: number; // How much to reduce counts over time (0-1)
}

interface UseExecutionHeatmapResult {
    heatmapData: HeatmapData;
    recordExecution: (nodeId: string, success: boolean, duration: number) => void;
    getNodeHeatLevel: (nodeId: string) => HeatLevel;
    getNodeHeatColor: (nodeId: string) => string;
    getNodeBorderColor: (nodeId: string) => string;
    getNodeStats: (nodeId: string) => NodeExecutionStats | undefined;
    clearStats: () => void;
    applyDecay: () => void;
}

/**
 * Calculate heat level based on execution count relative to max
 */
function calculateHeatLevel(count: number, maxCount: number): HeatLevel {
    if (maxCount === 0) return 'cold';

    const ratio = count / maxCount;

    if (ratio >= 0.75) return 'very-hot';
    if (ratio >= 0.5) return 'hot';
    if (ratio >= 0.25) return 'warm';
    return 'cold';
}

/**
 * Hook for tracking and visualizing node execution frequency
 */
export function useExecutionHeatmap({
    enabled = true,
    decayFactor = 0.9,
}: UseExecutionHeatmapOptions = {}): UseExecutionHeatmapResult {
    const [stats, setStats] = useState<Map<string, NodeExecutionStats>>(new Map());

    // Record a new execution for a node
    const recordExecution = useCallback((nodeId: string, success: boolean, duration: number) => {
        if (!enabled) return;

        setStats(prev => {
            const newStats = new Map(prev);
            const existing = newStats.get(nodeId);

            if (existing) {
                const newCount = existing.executionCount + 1;
                newStats.set(nodeId, {
                    ...existing,
                    executionCount: newCount,
                    successCount: existing.successCount + (success ? 1 : 0),
                    failureCount: existing.failureCount + (success ? 0 : 1),
                    avgDuration: (existing.avgDuration * existing.executionCount + duration) / newCount,
                    lastExecuted: new Date(),
                });
            } else {
                newStats.set(nodeId, {
                    nodeId,
                    executionCount: 1,
                    successCount: success ? 1 : 0,
                    failureCount: success ? 0 : 1,
                    avgDuration: duration,
                    lastExecuted: new Date(),
                });
            }

            return newStats;
        });
    }, [enabled]);

    // Calculate derived heatmap data
    const heatmapData = useMemo((): HeatmapData => {
        let maxExecutions = 0;
        let totalExecutions = 0;

        stats.forEach(stat => {
            maxExecutions = Math.max(maxExecutions, stat.executionCount);
            totalExecutions += stat.executionCount;
        });

        return {
            stats,
            maxExecutions,
            totalExecutions,
        };
    }, [stats]);

    // Get heat level for a specific node
    const getNodeHeatLevel = useCallback((nodeId: string): HeatLevel => {
        const nodeStat = stats.get(nodeId);
        if (!nodeStat) return 'cold';
        return calculateHeatLevel(nodeStat.executionCount, heatmapData.maxExecutions);
    }, [stats, heatmapData.maxExecutions]);

    // Get heat color for a specific node
    const getNodeHeatColor = useCallback((nodeId: string): string => {
        const level = getNodeHeatLevel(nodeId);
        return HEAT_COLORS[level];
    }, [getNodeHeatLevel]);

    // Get border color for a specific node
    const getNodeBorderColor = useCallback((nodeId: string): string => {
        const level = getNodeHeatLevel(nodeId);
        return HEAT_BORDER_COLORS[level];
    }, [getNodeHeatLevel]);

    // Get stats for a specific node
    const getNodeStats = useCallback((nodeId: string): NodeExecutionStats | undefined => {
        return stats.get(nodeId);
    }, [stats]);

    // Clear all stats
    const clearStats = useCallback(() => {
        setStats(new Map());
    }, []);

    // Apply decay to all stats (call periodically to "cool down" old executions)
    const applyDecay = useCallback(() => {
        setStats(prev => {
            const newStats = new Map<string, NodeExecutionStats>();

            prev.forEach((stat, nodeId) => {
                const decayedCount = Math.floor(stat.executionCount * decayFactor);
                if (decayedCount > 0) {
                    newStats.set(nodeId, {
                        ...stat,
                        executionCount: decayedCount,
                        successCount: Math.floor(stat.successCount * decayFactor),
                        failureCount: Math.floor(stat.failureCount * decayFactor),
                    });
                }
            });

            return newStats;
        });
    }, [decayFactor]);

    return {
        heatmapData,
        recordExecution,
        getNodeHeatLevel,
        getNodeHeatColor,
        getNodeBorderColor,
        getNodeStats,
        clearStats,
        applyDecay,
    };
}

export default useExecutionHeatmap;