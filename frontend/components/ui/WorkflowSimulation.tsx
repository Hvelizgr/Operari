"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface Node {
  id: string;
  labelEn: string;
  labelEs: string;
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

interface WorkflowSimulationProps {
  lang?: 'en' | 'es';
}

export default function WorkflowSimulation({ lang = 'en' }: WorkflowSimulationProps) {
  // Responsive layout with percentage-based positioning
  const [nodes, setNodes] = useState<Node[]>([
    { id: "1", labelEn: "Trigger", labelEs: "Inicio", icon: "⚡", x: 5, y: 40, state: "idle", color: "from-blue-500 to-cyan-500" },
    { id: "2", labelEn: "AI", labelEs: "IA", icon: "🤖", x: 22, y: 15, state: "idle", color: "from-purple-500 to-pink-500" },
    { id: "3", labelEn: "DB", labelEs: "BD", icon: "💾", x: 22, y: 65, state: "idle", color: "from-green-500 to-emerald-500" },
    { id: "4", labelEn: "Process", labelEs: "Proceso", icon: "⚙️", x: 40, y: 40, state: "idle", color: "from-orange-500 to-amber-500" },
    { id: "5", labelEn: "API", labelEs: "API", icon: "🌐", x: 58, y: 15, state: "idle", color: "from-pink-500 to-rose-500" },
    { id: "6", labelEn: "Notify", labelEs: "Notificar", icon: "🔔", x: 58, y: 65, state: "idle", color: "from-indigo-500 to-violet-500" },
    { id: "7", labelEn: "Done", labelEs: "Listo", icon: "✅", x: 78, y: 40, state: "idle", color: "from-emerald-500 to-teal-500" },
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
  const [dataPackets, setDataPackets] = useState<string[]>([]);

  useEffect(() => {
    const executionSequence = [
      { nodeIds: ["1"], connections: [], packets: ["1-2", "1-3"] },
      { nodeIds: ["2", "3"], connections: ["1-2", "1-3"], packets: ["2-4", "3-4"] },
      { nodeIds: ["4"], connections: ["2-4", "3-4"], packets: ["4-5", "4-6"] },
      { nodeIds: ["5", "6"], connections: ["4-5", "4-6"], packets: ["5-7", "6-7"] },
      { nodeIds: ["7"], connections: ["5-7", "6-7"], packets: [] },
      { nodeIds: [], connections: [], packets: [] },
    ];

    let currentStep = 0;

    const interval = setInterval(() => {
      const nextStep = (currentStep + 1) % executionSequence.length;
      const step = executionSequence[nextStep];

      if (nextStep === 0) {
        setNodes((prevNodes) =>
          prevNodes.map((node) => ({ ...node, state: "idle" }))
        );
        setActiveConnections(new Set());
        setDataPackets([]);
      } else {
        setNodes((prevNodes) =>
          prevNodes.map((node) => {
            if (step.nodeIds.includes(node.id)) {
              return { ...node, state: "running" };
            }
            const prevStepNodeIds = executionSequence[currentStep]?.nodeIds || [];
            if (prevStepNodeIds.includes(node.id)) {
              return { ...node, state: "success" };
            }
            return node;
          })
        );
        setActiveConnections(new Set(step.connections));
        setDataPackets(step.packets);
      }

      currentStep = nextStep;
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Convert percentage to pixel for SVG paths (based on 500x300 viewBox)
  const pctToX = (pct: number) => (pct / 100) * 500;
  const pctToY = (pct: number) => (pct / 100) * 300;

  const getNodePosition = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? { x: pctToX(node.x), y: pctToY(node.y) } : { x: 0, y: 0 };
  };

  return (
    <div className="relative w-full h-full min-h-[280px] bg-transparent rounded-xl overflow-visible">
      {/* SVG Connections */}
      <svg 
        className="absolute inset-0 w-full h-full" 
        viewBox="0 0 500 300"
        preserveAspectRatio="xMidYMid meet"
        style={{ zIndex: 1 }}
      >
        <defs>
          <linearGradient id="connGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {connections.map((conn, index) => {
          const fromNode = getNodePosition(conn.from);
          const toNode = getNodePosition(conn.to);
          const connectionKey = `${conn.from}-${conn.to}`;
          const isActive = activeConnections.has(connectionKey);
          const hasPacket = dataPackets.includes(connectionKey);

          const fromX = fromNode.x + 45;
          const fromY = fromNode.y + 20;
          const toX = toNode.x;
          const toY = toNode.y + 20;
          const midX = (fromX + toX) / 2;
          const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

          return (
            <g key={index}>
              {/* Base connection line */}
              <motion.path
                d={path}
                fill="none"
                stroke="url(#connGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: index * 0.08 }}
              />

              {/* Active glow line */}
              <AnimatePresence>
                {isActive && (
                  <motion.path
                    d={path}
                    fill="none"
                    stroke="url(#activeGrad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    filter="url(#glow)"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  />
                )}
              </AnimatePresence>

              {/* Data packet animation */}
              <AnimatePresence>
                {hasPacket && (
                  <motion.circle
                    r="5"
                    fill="#3b82f6"
                    filter="url(#glow)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <animateMotion dur="0.5s" repeatCount="1" fill="freeze">
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

      {/* Nodes - Using percentage positioning */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        {nodes.map((node, index) => (
          <motion.div
            key={node.id}
            className="absolute"
            style={{ 
              left: `${node.x}%`, 
              top: `${node.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.08, duration: 0.3, type: "spring" }}
          >
            {/* Node card */}
            <div
              className={`
                relative w-16 h-14 sm:w-20 sm:h-16 rounded-xl
                bg-gradient-to-br ${node.color}
                flex flex-col items-center justify-center
                shadow-lg
                ${node.state === "running" ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-black/50" : ""}
                ${node.state === "success" ? "ring-2 ring-green-400 ring-offset-2 ring-offset-black/50" : ""}
                transition-all duration-300
              `}
            >
              {/* Icon */}
              <motion.span
                className="text-xl sm:text-2xl"
                animate={
                  node.state === "running"
                    ? { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }
                    : {}
                }
                transition={
                  node.state === "running"
                    ? { duration: 0.5, repeat: Infinity }
                    : {}
                }
              >
                {node.icon}
              </motion.span>
              
              {/* Label - Translation aware */}
              <span className="text-[9px] sm:text-[10px] font-semibold text-white/90 mt-0.5 truncate max-w-full px-1">
                {lang === 'es' ? node.labelEs : node.labelEn}
              </span>

              {/* Running pulse */}
              <AnimatePresence>
                {node.state === "running" && (
                  <motion.div
                    className="absolute -inset-1 rounded-xl border-2 border-yellow-400"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </AnimatePresence>

              {/* Success checkmark */}
              <AnimatePresence>
                {node.state === "success" && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Status bar */}
      <motion.div 
        className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/40 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ zIndex: 3 }}
      >
        <div className="flex items-center gap-3 text-[10px] sm:text-xs text-white/70">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gray-400" />
            <span>{lang === 'es' ? 'Espera' : 'Idle'}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span>{lang === 'es' ? 'Ejecutando' : 'Running'}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400" />
            <span>{lang === 'es' ? 'Listo' : 'Done'}</span>
          </div>
        </div>
        <div className="text-[10px] sm:text-xs font-mono text-green-400">
          <span className="animate-pulse">●</span> Live
        </div>
      </motion.div>
    </div>
  );
}
