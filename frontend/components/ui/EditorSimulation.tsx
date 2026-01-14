"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState, useRef } from "react";

interface Node {
  id: string;
  type: "trigger" | "action" | "condition" | "output";
  label: string;
  icon: string;
  x: number;
  y: number;
  color: string;
}

interface Connection {
  from: string;
  to: string;
}

export default function EditorSimulation() {
  const [nodes, setNodes] = useState<Node[]>([
    { id: "1", type: "trigger", label: "Webhook", icon: "⚡", x: 100, y: 200, color: "from-blue-500 to-cyan-500" },
    { id: "2", type: "condition", label: "Filter", icon: "🔍", x: 300, y: 150, color: "from-purple-500 to-pink-500" },
    { id: "3", type: "action", label: "Database", icon: "💾", x: 300, y: 250, color: "from-green-500 to-emerald-500" },
    { id: "4", type: "action", label: "Transform", icon: "⚙️", x: 500, y: 200, color: "from-orange-500 to-red-500" },
    { id: "5", type: "output", label: "Send Email", icon: "📧", x: 700, y: 200, color: "from-indigo-500 to-purple-500" },
  ]);

  const [connections] = useState<Connection[]>([
    { from: "1", to: "2" },
    { from: "1", to: "3" },
    { from: "2", to: "4" },
    { from: "3", to: "4" },
    { from: "4", to: "5" },
  ]);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingNodes, setExecutingNodes] = useState<Set<string>>(new Set());
  const [executingConnections, setExecutingConnections] = useState<Set<string>>(new Set());

  const handleExecute = () => {
    if (isExecuting) return;

    setIsExecuting(true);
    setExecutingNodes(new Set());
    setExecutingConnections(new Set());

    const sequence = [
      { nodeId: "1", delay: 0 },
      { connId: "1-2", delay: 500 },
      { connId: "1-3", delay: 500 },
      { nodeId: "2", delay: 1000 },
      { nodeId: "3", delay: 1000 },
      { connId: "2-4", delay: 1500 },
      { connId: "3-4", delay: 1500 },
      { nodeId: "4", delay: 2000 },
      { connId: "4-5", delay: 2500 },
      { nodeId: "5", delay: 3000 },
    ];

    sequence.forEach((item) => {
      setTimeout(() => {
        if ("nodeId" in item) {
          setExecutingNodes((prev) => new Set([...prev, item.nodeId as string]));
        } else {
          setExecutingConnections((prev) => new Set([...prev, item.connId as string]));
        }
      }, item.delay);
    });

    setTimeout(() => {
      setIsExecuting(false);
      setExecutingNodes(new Set());
      setExecutingConnections(new Set());
    }, 3500);
  };

  const getNodePosition = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? { x: node.x + 50, y: node.y + 40 } : { x: 0, y: 0 };
  };

  const handleNodeDragEnd = (nodeId: string, x: number, y: number) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) =>
        node.id === nodeId ? { ...node, x: node.x + x, y: node.y + y } : node
      )
    );
  };

  return (
    <div className="relative w-full h-[600px] bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl overflow-hidden border border-gray-200 shadow-2xl">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border border-gray-200">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-gray-700">Workflow Editor</span>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExecute}
            disabled={isExecuting}
            className="px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExecuting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
                <span>Running...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                <span>Execute</span>
              </>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200"
          >
            Save
          </motion.button>
        </div>
      </div>

      <div className="absolute inset-0 bg-grid-slate-200/30" style={{ backgroundSize: "30px 30px" }} />

      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6" />
          </linearGradient>

          <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {connections.map((conn) => {
          const from = getNodePosition(conn.from);
          const to = getNodePosition(conn.to);
          const connKey = `${conn.from}-${conn.to}`;
          const isActive = executingConnections.has(connKey);

          const midX = (from.x + to.x) / 2;
          const path = `M ${from.x} ${from.y} Q ${midX} ${from.y} ${midX} ${(from.y + to.y) / 2} T ${to.x} ${to.y}`;

          return (
            <g key={connKey}>
              <motion.path
                d={path}
                fill="none"
                stroke="url(#connectionGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              />

              {isActive && (
                <>
                  <motion.path
                    d={path}
                    fill="none"
                    stroke="url(#activeGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    filter="url(#glow)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                  <motion.circle
                    r="6"
                    fill="#3b82f6"
                    filter="url(#glow)"
                  >
                    <animateMotion dur="0.5s" repeatCount="1">
                      <mpath href={`#path-${connKey}`} />
                    </animateMotion>
                  </motion.circle>
                </>
              )}

              <path id={`path-${connKey}`} d={path} fill="none" opacity="0" />
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0" style={{ zIndex: 10 }}>
        {nodes.map((node) => {
          const isExecuting = executingNodes.has(node.id);
          const isSelected = selectedNode === node.id;

          return (
            <motion.div
              key={node.id}
              drag
              dragMomentum={false}
              dragElastic={0}
              onDragEnd={(_, info) => handleNodeDragEnd(node.id, info.offset.x, info.offset.y)}
              onClick={() => setSelectedNode(node.id)}
              className="absolute cursor-move"
              style={{ left: node.x, top: node.y }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className={`w-24 h-20 bg-white rounded-xl shadow-lg border-2 transition-all duration-300 ${isSelected ? "border-primary-500 ring-4 ring-primary-500/20" : "border-gray-200"
                  } ${isExecuting ? "ring-4 ring-green-500/50" : ""}`}
                animate={isExecuting ? { scale: [1, 1.1, 1] } : {}}
                transition={isExecuting ? { duration: 0.5, repeat: 2 } : {}}
              >
                <div className="flex flex-col items-center justify-center h-full p-2 relative">
                  <div
                    className={`absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br ${node.color} rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg`}
                  >
                    {node.id}
                  </div>

                  {isExecuting && (
                    <motion.div
                      className="absolute -inset-1 border-2 border-green-500 rounded-xl"
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 1.3, opacity: 0 }}
                      transition={{ duration: 0.5, repeat: 2 }}
                    />
                  )}

                  <motion.div
                    className="text-3xl mb-1"
                    animate={isExecuting ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={isExecuting ? { duration: 0.5 } : {}}
                  >
                    {node.icon}
                  </motion.div>
                  <span className="text-xs font-semibold text-gray-700 text-center leading-tight">
                    {node.label}
                  </span>

                  {isExecuting && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -bottom-2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                    >
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary-500 rounded-full" />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary-500 rounded-full" />
            </motion.div>
          );
        })}
      </div>

      {selectedNode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm px-6 py-3 rounded-lg shadow-xl border border-gray-200 z-20"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">
              Node {selectedNode} selected
            </span>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </motion.div>
      )}

      <div className="absolute bottom-4 right-4 flex gap-2 z-20">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
