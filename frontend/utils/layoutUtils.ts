import dagre from 'dagre';
import { WorkflowNode, Connection } from '@nanoflow/shared';
import { getNodeInputPort, getNodeOutputPort } from '../components/Editor/EditorNode';

// Configuration for layout
const NODE_WIDTH = 250;
const NODE_HEIGHT = 100;
const SEPARATION_X = 50;
const SEPARATION_Y = 50;

export const getAutoLayout = (nodes: WorkflowNode[], connections: Connection[], direction: 'LR' | 'TB' = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Set Graph Config
    dagreGraph.setGraph({
        rankdir: direction,
        align: 'UL', // Up-Left alignment
        nodesep: SEPARATION_Y, // Vertical separation between nodes in same rank? No, nodesep is separation between adjacent nodes in same rank.
        ranksep: SEPARATION_X, // Separation between ranks.
        ranker: 'tight-tree' // 'network-simplex', 'tight-tree', or 'longest-path'
    });

    // Add Nodes
    nodes.forEach((node) => {
        // Use actual dimensions if available, else default
        // const width = (node as any).dimensions?.width || NODE_WIDTH;
        // const height = (node as any).dimensions?.height || NODE_HEIGHT;
        // Using fixed size for layout uniformity usually looks better, but let's try vaguely accurate.

        // Wait, dagre needs center? No, top-left by default? 
        // "Dagre expects the top-left corner of the node to be at (x, y)?"
        // Actually Dagre outputs Center coordinates. We need to convert.

        dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    // Add Edges
    connections.forEach((conn) => {
        dagreGraph.setEdge(conn.source, conn.target);
    });

    // Layout
    dagre.layout(dagreGraph);

    // Get nodes back
    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);

        // Dagre returns center x,y. We likely use top-left in our canvas.
        // NanoRun `node.position` is top-left.
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - (NODE_WIDTH / 2),
                y: nodeWithPosition.y - (NODE_HEIGHT / 2),
            },
        };
    });

    return { nodes: layoutedNodes };
};
