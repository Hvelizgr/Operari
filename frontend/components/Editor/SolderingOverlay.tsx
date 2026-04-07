// Adapted from xyOps Workflow Editor
// Original: Copyright (c) 2019 - 2026 PixlCore LLC
// License: BSD 3-Clause (see xyOps LICENSE.md)
// Adapted for NanoRun

'use client';

import { Plus } from 'lucide-react';
import type { WorkflowNode } from '@nanoflow/shared';
import type { PortType } from '../../hooks/useEditorSoldering';
import type { ViewportState } from '../../types/editor.types';

interface SolderingOverlayProps {
    nodes: WorkflowNode[];
    solderingNodeId: string | null;
    solderingEndPort: PortType;
    viewport: ViewportState;
    onPortClick: (nodeId: string) => void;
}

export default function SolderingOverlay({
    nodes,
    solderingNodeId,
    solderingEndPort,
    viewport,
    onPortClick
}: SolderingOverlayProps) {
    if (!solderingNodeId) return null;

    // Filter nodes to show only compatible ports (xyOps lines 921-934)
    const compatibleNodes = nodes.filter(node => node.id !== solderingNodeId);

    return (
        <>
            {/* Mouse tracker dot (xyOps lines 937-938) */}
            <div className="wf-mouse-tracker" id="wf-mouse-tracker" />

            {/* Port buttons on compatible nodes (xyOps lines 921-934) */}
            {compatibleNodes.map(node => (
                <PortButton
                    key={node.id}
                    node={node}
                    portType={solderingEndPort}
                    viewport={viewport}
                    onClick={() => onPortClick(node.id)}
                />
            ))}
        </>
    );
}

interface PortButtonProps {
    node: WorkflowNode;
    portType: PortType;
    viewport: ViewportState;
    onClick: () => void;
}

function PortButton({ node, portType, viewport, onClick }: PortButtonProps) {
    const { x, y, zoom } = viewport;

    // Calculate screen position of the node
    // Formula: NodePos * Zoom + Pan
    const screenLeft = node.position.x * zoom + x;
    const screenTop = node.position.y * zoom + y;

    // Scale dimensions
    const width = 220 * zoom;
    // Estimate height or just use the anchor
    // We just need the relative anchor helper

    // Position button based on port type (xyOps logic)
    // We must apply ZOOM to the offset (12px becomes 12 * zoom)
    const getPortPosition = () => {
        const offset = -12 * zoom;
        switch (portType) {
            case 'input':
                return { left: offset, top: '50%', transform: 'translateY(-50%)' };
            case 'output':
                return { right: offset, top: '50%', transform: 'translateY(-50%)' };
            case 'up':
                return { left: '50%', top: offset, transform: 'translateX(-50%)' };
            case 'down':
                return { left: '50%', bottom: offset, transform: 'translateX(-50%)' };
        }
    };

    return (
        <div
            style={{
                position: 'absolute',
                left: screenLeft,
                top: screenTop,
                width: width,
                height: 100 * zoom, // Approx height, doesn't strictly matter as long as relative anchors work
                pointerEvents: 'none', // Pass through to node
                zIndex: 1000
            }}
        >
            <button
                className="wf-pole-button soldering"
                style={{
                    ...getPortPosition(),
                    position: 'absolute',
                    pointerEvents: 'auto',
                    width: 24 * zoom, // Scale button
                    height: 24 * zoom,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onMouseUp={(e) => {
                    // Handle drag-release on this button
                    e.stopPropagation();
                    onClick();
                }}
                onPointerDown={(e) => {
                    e.stopPropagation();
                }}
                aria-label={`Connect to ${node.id}`}
            >
                <Plus size={14 * zoom} />
            </button>
        </div>
    );
}
