'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Download, Loader2 } from 'lucide-react';

interface GraphNode {
    id: number;
    name: string;
    type: string;
    description: string;
    group: number;
}

interface GraphLink {
    source: number;
    target: number;
    description: string;
    strength: number;
}

interface KnowledgeGraphViewerProps {
    nodes: GraphNode[];
    links: GraphLink[];
    width?: number;
    height?: number;
    onNodeClick?: (node: GraphNode) => void;
}

const NODE_COLORS: Record<number, string> = {
    1: '#ef4444',
    2: '#3b82f6',
    3: '#22c55e',
    4: '#f59e0b',
    5: '#8b5cf6',
    6: '#06b6d4',
    0: '#6b7280',
};

const TYPE_LABELS: Record<number, string> = {
    1: 'Person',
    2: 'Organization',
    3: 'Location',
    4: 'Event',
    5: 'Concept',
    6: 'Technology',
    0: 'Other',
};

export function KnowledgeGraphViewer({
    nodes,
    links,
    width = 800,
    height = 600,
    onNodeClick,
}: KnowledgeGraphViewerProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const [nodePositions, setNodePositions] = useState<Map<number, { x: number; y: number }>>(new Map());

    useEffect(() => {
        const positions = new Map<number, { x: number; y: number }>();
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.35;

        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            positions.set(node.id, {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            });
        });

        for (let iteration = 0; iteration < 50; iteration++) {
            nodes.forEach(node => {
                const pos = positions.get(node.id)!;
                let fx = 0, fy = 0;

                nodes.forEach(other => {
                    if (node.id === other.id) return;
                    const otherPos = positions.get(other.id)!;
                    const dx = pos.x - otherPos.x;
                    const dy = pos.y - otherPos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = 5000 / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                });

                links.forEach(link => {
                    let otherPos: { x: number; y: number } | undefined;
                    if (link.source === node.id) {
                        otherPos = positions.get(link.target);
                    } else if (link.target === node.id) {
                        otherPos = positions.get(link.source);
                    }
                    if (otherPos) {
                        const dx = otherPos.x - pos.x;
                        const dy = otherPos.y - pos.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const force = dist * 0.01;
                        fx += (dx / dist) * force;
                        fy += (dy / dist) * force;
                    }
                });

                fx += (centerX - pos.x) * 0.001;
                fy += (centerY - pos.y) * 0.001;

                positions.set(node.id, {
                    x: Math.max(50, Math.min(width - 50, pos.x + fx * 0.1)),
                    y: Math.max(50, Math.min(height - 50, pos.y + fy * 0.1)),
                });
            });
        }

        setNodePositions(positions);
    }, [nodes, links, width, height]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging) {
            setPan({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
    }, []);

    const handleNodeClick = useCallback((node: GraphNode) => {
        setSelectedNode(node);
        onNodeClick?.(node);
    }, [onNodeClick]);

    const resetView = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setSelectedNode(null);
    }, []);

    const exportSVG = useCallback(() => {
        if (!svgRef.current) return;
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'knowledge-graph.svg';
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg">
                <button
                    onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
                    className="p-2 hover:bg-slate-700 rounded transition-colors"
                    title="Zoom In"
                >
                    <ZoomIn size={18} />
                </button>
                <button
                    onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
                    className="p-2 hover:bg-slate-700 rounded transition-colors"
                    title="Zoom Out"
                >
                    <ZoomOut size={18} />
                </button>
                <button
                    onClick={() => setZoom(1)}
                    className="p-2 hover:bg-slate-700 rounded transition-colors"
                    title="Fit to Screen"
                >
                    <Maximize2 size={18} />
                </button>
                <button
                    onClick={resetView}
                    className="p-2 hover:bg-slate-700 rounded transition-colors"
                    title="Reset View"
                >
                    <RotateCcw size={18} />
                </button>
                <div className="flex-1" />
                <span className="text-sm text-slate-400">
                    {nodes.length} nodes, {links.length} links
                </span>
                <button
                    onClick={exportSVG}
                    className="p-2 hover:bg-slate-700 rounded transition-colors"
                    title="Export SVG"
                >
                    <Download size={18} />
                </button>
            </div>

            <div className="flex gap-2 flex-wrap">
                {Object.entries(TYPE_LABELS).map(([group, label]) => (
                    <div key={group} className="flex items-center gap-1 text-xs">
                        <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: NODE_COLORS[Number(group)] }}
                        />
                        <span className="text-slate-400">{label}</span>
                    </div>
                ))}
            </div>

            <div
                className="border border-slate-700 rounded-lg overflow-hidden bg-slate-900 cursor-move"
                style={{ width, height }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <svg
                    ref={svgRef}
                    width={width}
                    height={height}
                    style={{ background: '#0f172a' }}
                >
                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                        <defs>
                            <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="7"
                                refX="25"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3.5, 0 7" fill="#475569" />
                            </marker>
                        </defs>

                        {links.map((link, i) => {
                            const sourcePos = nodePositions.get(link.source);
                            const targetPos = nodePositions.get(link.target);
                            if (!sourcePos || !targetPos) return null;

                            const isHighlighted =
                                selectedNode?.id === link.source ||
                                selectedNode?.id === link.target ||
                                hoveredNode?.id === link.source ||
                                hoveredNode?.id === link.target;

                            return (
                                <g key={`link-${i}`}>
                                    <line
                                        x1={sourcePos.x}
                                        y1={sourcePos.y}
                                        x2={targetPos.x}
                                        y2={targetPos.y}
                                        stroke={isHighlighted ? '#94a3b8' : '#334155'}
                                        strokeWidth={Math.max(1, link.strength / 3)}
                                        strokeOpacity={isHighlighted ? 1 : 0.5}
                                        markerEnd="url(#arrowhead)"
                                    />
                                    {isHighlighted && (
                                        <text
                                            x={(sourcePos.x + targetPos.x) / 2}
                                            y={(sourcePos.y + targetPos.y) / 2 - 5}
                                            textAnchor="middle"
                                            fill="#94a3b8"
                                            fontSize={10}
                                            className="pointer-events-none"
                                        >
                                            {link.description.slice(0, 30)}
                                            {link.description.length > 30 ? '...' : ''}
                                        </text>
                                    )}
                                </g>
                            );
                        })}

                        {nodes.map(node => {
                            const pos = nodePositions.get(node.id);
                            if (!pos) return null;

                            const isSelected = selectedNode?.id === node.id;
                            const isHovered = hoveredNode?.id === node.id;
                            const radius = isSelected ? 20 : isHovered ? 18 : 15;

                            return (
                                <g
                                    key={`node-${node.id}`}
                                    transform={`translate(${pos.x}, ${pos.y})`}
                                    onClick={() => handleNodeClick(node)}
                                    onMouseEnter={() => setHoveredNode(node)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <circle
                                        r={radius}
                                        fill={NODE_COLORS[node.group]}
                                        stroke={isSelected ? '#fff' : isHovered ? '#e2e8f0' : 'transparent'}
                                        strokeWidth={2}
                                        className="transition-all duration-150"
                                    />
                                    <text
                                        y={radius + 15}
                                        textAnchor="middle"
                                        fill="#e2e8f0"
                                        fontSize={11}
                                        fontWeight={isSelected ? 'bold' : 'normal'}
                                        className="pointer-events-none"
                                    >
                                        {node.name.length > 15 ? node.name.slice(0, 15) + '...' : node.name}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </svg>
            </div>

            {selectedNode && (
                <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <span
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: NODE_COLORS[selectedNode.group] }}
                        />
                        <h3 className="text-lg font-semibold">{selectedNode.name}</h3>
                        <span className="text-sm text-slate-400 capitalize">({selectedNode.type})</span>
                    </div>
                    <p className="text-sm text-slate-300">{selectedNode.description}</p>
                </div>
            )}
        </div>
    );
}

interface KnowledgeGraphExtractorProps {
    apiUrl?: string;
}

export function KnowledgeGraphExtractor({ apiUrl = '' }: KnowledgeGraphExtractorProps) {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const extractGraph = async () => {
        if (!text.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${apiUrl}/api/ai/graph-extract/d3`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language: 'English' }),
            });

            if (!response.ok) {
                throw new Error('Failed to extract knowledge graph');
            }

            const data = await response.json();
            setGraphData({ nodes: data.nodes, links: data.links });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">
                    Paste text to extract knowledge graph
                </label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text to analyze..."
                    className="w-full h-40 p-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                    onClick={extractGraph}
                    disabled={isLoading || !text.trim()}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Extracting...
                        </>
                    ) : (
                        'Extract Knowledge Graph'
                    )}
                </button>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {graphData && graphData.nodes.length > 0 && (
                <KnowledgeGraphViewer
                    nodes={graphData.nodes}
                    links={graphData.links}
                    width={900}
                    height={600}
                />
            )}

            {graphData && graphData.nodes.length === 0 && (
                <div className="p-4 bg-slate-800 rounded-lg text-center text-slate-400">
                    No entities or relationships found in the text.
                </div>
            )}
        </div>
    );
}
