import { WorkflowNode, Connection } from '@nanoflow/shared';
import { NodeType } from '../Node';
import { ExecutionMetric, ViewportState } from '../../types/editor.types';

export const createNewNode = (
    nodeType: NodeType | string,
    viewport: ViewportState,
    windowSize: { width: number; height: number },
    lang: 'en' | 'es',
    position?: { x: number; y: number }
): WorkflowNode => {
    const centerX = position?.x ?? (windowSize.width / 2 - viewport.x) / viewport.zoom;
    const centerY = position?.y ?? (windowSize.height / 2 - viewport.y) / viewport.zoom;
    
    const nodeTypeObj = typeof nodeType === 'string' ? null : nodeType;
    const type = typeof nodeType === 'string' ? nodeType : nodeType.type;
    const title = nodeTypeObj?.label?.[lang] ?? type;
    
    return {
        id: `node-${Date.now()}`,
        position: { x: position ? centerX : centerX - 128, y: position ? centerY : centerY - 32 },
        title,
        type,
        inputs: [{ id: 'in', label: 'Input' }],
        outputs: [{ id: 'out', label: 'Output' }],
    };
};

export const createDroppedNode = (
    nodeType: NodeType,
    clientX: number,
    clientY: number,
    canvasRect: DOMRect,
    viewport: ViewportState,
    lang: 'en' | 'es'
): WorkflowNode => {
    const x = (clientX - canvasRect.left - viewport.x) / viewport.zoom;
    const y = (clientY - canvasRect.top - viewport.y) / viewport.zoom;

    return {
        id: `node-${Date.now()}`,
        position: { x, y },
        title: nodeType.label[lang],
        type: nodeType.type,
    };
};

export const generateExecutionMetrics = (
    updatedNodes: WorkflowNode[],
    prevNodes: WorkflowNode[]
): ExecutionMetric[] => {
    const newMetrics: ExecutionMetric[] = [];

    updatedNodes.forEach((updatedNode) => {
        const prevNode = prevNodes.find(n => n.id === updatedNode.id);

        if (prevNode?.executionState === 'running' &&
            (updatedNode.executionState === 'success' || updatedNode.executionState === 'error')) {
            newMetrics.push({
                nodeId: updatedNode.id,
                nodeName: updatedNode.title,
                executionTime: Math.floor(Math.random() * 1000) + 500, // Mock time
                status: updatedNode.executionState,
                timestamp: Date.now(),
            });
        }
    });

    return newMetrics;
};
