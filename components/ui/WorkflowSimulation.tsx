"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface Node {
  id: string;
  label: string;
  icon: string;
  x: number;
  y: number;
  state: "idle" | "running" | "success" | "error";
  color: string;
}

interface Connection {
  from: string;
  to: string;
}

export default function WorkflowSimulation() {
  const [nodes, setNodes] = useState<Node[]>([
    { id: "1", label: "Webhook", icon: "⚡", x: 50, y: 150, state: "idle", color: "bg-blue-500" },
    { id: "2", label: "Filter", icon: "🔍", x: 200, y: 100, state: "idle", color: "bg-purple-500" },
    { id: "3", label: "Database", icon: "💾", x: 200, y: 200, state: "idle", color: "bg-green-500" },
    { id: "4", label: "Transform", icon: "⚙️", x: 350, y: 150, state: "idle", color: "bg-orange-500" },
    { id: "5", label: "API Call", icon: "🌐", x: 500, y: 100, state: "idle", color: "bg-pink-500" },
    { id: "6", label: "Email", icon: "📧", x: 500, y: 200, state: "idle", color: "bg-indigo-500" },
    { id: "7", label: "Success", icon: "✓", x: 650, y: 150, state: "idle", color: "bg-emerald-500" },
  ]);

  const connections: Connection[] = [
    { from: "1", to: "2" },
    { from: "1", to: "3" },
    { from: "2", to: "4" },
    { from: "3", to: "4" },
    { from: "4", to: "5" },
    { from: "4", to: "6" },
    { from: "5", to: "7" },
    { from: "6", to: "7" },
  ];

  const [activeConnections, setActiveConnections] = useState<Set<string>>(new Set());
  const [executionStep, setExecutionStep] = useState(0);

  useEffect(() => {
    const executionSequence = [
      { nodeIds: ["1"], connections: [] },
      { nodeIds: ["2", "3"], connections: ["1-2", "1-3"] },
      { nodeIds: ["4"], connections: ["2-4", "3-4"] },
      { nodeIds: ["5", "6"], connections: ["4-5", "4-6"] },
      { nodeIds: ["7"], connections: ["5-7", "6-7"] },
      { nodeIds: [], connections: [] },
    ];

    const interval = setInterval(() => {
      setExecutionStep((prev) => {
        const nextStep = (prev + 1) % executionSequence.length;
        const step = executionSequence[nextStep];

        if (nextStep === 0) {
          setNodes((prevNodes) =>
            prevNodes.map((node) => ({ ...node, state: "idle" }))
          );
          setActiveConnections(new Set());
        } else {
          setNodes((prevNodes) =>
            prevNodes.map((node) => {
              if (step.nodeIds.includes(node.id)) {
                return { ...node, state: "running" };
              }
              const prevStepNodeIds = executionSequence[prev]?.nodeIds || [];
              if (prevStepNodeIds.includes(node.id)) {
                return { ...node, state: "success" };
              }
              return node;
            })
          );
          setActiveConnections(new Set(step.connections));
        }

        return nextStep;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  const getNodePosition = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  };

  const getNodeStateColor = (state: string) => {
    switch (state) {
      case "running":
        return "border-yellow-400 shadow-yellow-400/50";
      case "success":
        return "border-green-400 shadow-green-400/50";
      case "error":
        return "border-red-400 shadow-red-400/50";
      default:
        return "border-gray-300 shadow-gray-300/30";
    }
  };

  return (
    <div className="relative w-full h-[400px] bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl overflow-hidden border border-gray-200">
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {connections.map((conn, index) => {
          const fromNode = getNodePosition(conn.from);
          const toNode = getNodePosition(conn.to);
          const connectionKey = `${conn.from}-${conn.to}`;
          const isActive = activeConnections.has(connectionKey);

          const fromX = fromNode.x + 40;
          const fromY = fromNode.y + 25;
          const toX = toNode.x;
          const toY = toNode.y + 25;

          const midX = (fromX + toX) / 2;

          const path = `M ${fromX} ${fromY} Q ${midX} ${fromY} ${midX} ${(fromY + toY) / 2} T ${toX} ${toY}`;

          return (
            <g key={index}>
              <motion.path
                d={path}
                fill="none"
                stroke="url(#connectionGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              />

              <AnimatePresence>
                {isActive && (
                  <motion.path
                    d={path}
                    fill="none"
                    stroke="url(#activeGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  />
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isActive && (
                  <motion.circle
                    r="4"
                    fill="#3b82f6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  >
                    <animateMotion dur="0.6s" repeatCount="1">
                      <mpath href={`#path-${index}`} />
                    </animateMotion>
                  </motion.circle>
                )}
              </AnimatePresence>

              <path id={`path-${index}`} d={path} fill="none" opacity="0" />
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        {nodes.map((node, index) => (
          <motion.div
            key={node.id}
            className={`absolute w-20 h-12 flex flex-col items-center justify-center bg-white rounded-lg border-2 transition-all duration-300 ${getNodeStateColor(
              node.state
            )}`}
            style={{
              left: node.x,
              top: node.y,
              boxShadow:
                node.state === "running"
                  ? "0 0 20px rgba(251, 191, 36, 0.5)"
                  : node.state === "success"
                  ? "0 0 20px rgba(74, 222, 128, 0.5)"
                  : "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
          >
            <motion.div
              className="text-2xl"
              animate={
                node.state === "running"
                  ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }
                  : {}
              }
              transition={
                node.state === "running"
                  ? { duration: 0.6, repeat: Infinity }
                  : {}
              }
            >
              {node.icon}
            </motion.div>
            <span className="text-[8px] font-medium text-gray-600 mt-0.5">
              {node.label}
            </span>

            <AnimatePresence>
              {node.state === "running" && (
                <motion.div
                  className="absolute -inset-1 border-2 border-yellow-400 rounded-lg"
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 1.3, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {node.state === "success" && (
                <motion.div
                  className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <svg
                    className="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-gray-200" style={{ zIndex: 3 }}>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-gray-300 rounded-full"></div>
            <span className="text-gray-600">Idle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-gray-600">Running</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-green-400 rounded-full"></div>
            <span className="text-gray-600">Success</span>
          </div>
        </div>
      </div>

      <motion.div
        className="absolute top-4 right-4 bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-full"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ zIndex: 3 }}
      >
        Live Preview
      </motion.div>
    </div>
  );
}
