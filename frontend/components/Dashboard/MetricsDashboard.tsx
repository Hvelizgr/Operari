'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, CheckCircle, Clock, TrendingUp, X, XCircle } from 'lucide-react';
import { useState } from 'react';

interface ExecutionMetric {
  nodeId: string;
  nodeName: string;
  executionTime: number;
  status: 'success' | 'error';
  timestamp: number;
}

interface MetricsDashboardProps {
  metrics: ExecutionMetric[];
  lang: 'en' | 'es';
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function MetricsDashboard({
  metrics,
  lang,
  isOpen: controlledIsOpen,
  onOpenChange,
}: MetricsDashboardProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  const content = {
    en: {
      title: 'Workflow Metrics',
      totalExecutions: 'Total Executions',
      successRate: 'Success Rate',
      avgExecutionTime: 'Avg Execution Time',
      nodePerformance: 'Node Performance',
      executions: 'executions',
      ms: 'ms',
      recent: 'Recent Executions',
      noData: 'No execution data available',
      close: 'Close',
    },
    es: {
      title: 'Métricas del Flujo',
      totalExecutions: 'Ejecuciones Totales',
      successRate: 'Tasa de Éxito',
      avgExecutionTime: 'Tiempo Promedio',
      nodePerformance: 'Rendimiento de Nodos',
      executions: 'ejecuciones',
      ms: 'ms',
      recent: 'Ejecuciones Recientes',
      noData: 'No hay datos de ejecución',
      close: 'Cerrar',
    },
  };

  const text = content[lang] || content['en'];

  const totalExecutions = metrics.length;
  const successCount = metrics.filter(m => m.status === 'success').length;
  const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;
  const avgExecutionTime =
    totalExecutions > 0
      ? metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalExecutions
      : 0;

  const nodeStats = metrics.reduce(
    (acc, metric) => {
      if (!acc[metric.nodeId]) {
        acc[metric.nodeId] = {
          name: metric.nodeName,
          count: 0,
          totalTime: 0,
          successes: 0,
        };
      }
      acc[metric.nodeId].count++;
      acc[metric.nodeId].totalTime += metric.executionTime;
      if (metric.status === 'success') acc[metric.nodeId].successes++;
      return acc;
    },
    {} as Record<string, { name: string; count: number; totalTime: number; successes: number }>
  );

  const topNodes = Object.entries(nodeStats)
    .map(([id, stats]) => ({
      id,
      name: stats.name,
      avgTime: stats.totalTime / stats.count,
      successRate: (stats.successes / stats.count) * 100,
      count: stats.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Hide the internal button when controlled externally
  const showInternalButton = controlledIsOpen === undefined;

  return (
    <>
      {showInternalButton && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute left-1/2 top-4 z-40 flex translate-x-24 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 shadow-lg transition-colors hover:bg-slate-700"
        >
          <BarChart3 size={16} />
          Metrics
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              className="relative mx-4 max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={24} className="text-primary" />
                  <h2 className="text-2xl font-bold text-slate-100">{text.title}</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 transition-colors hover:text-slate-200"
                >
                  <X size={24} />
                </button>
              </div>

              {totalExecutions === 0 ? (
                <div className="py-12 text-center text-slate-400">{text.noData}</div>
              ) : (
                <>
                  <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
                        <TrendingUp size={16} />
                        {text.totalExecutions}
                      </div>
                      <div className="text-2xl font-bold text-slate-100">{totalExecutions}</div>
                      <div className="mt-1 text-xs text-slate-500">{text.executions}</div>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
                        <CheckCircle size={16} />
                        {text.successRate}
                      </div>
                      <div className="text-2xl font-bold text-green-400">
                        {successRate.toFixed(1)}%
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
                        <Clock size={16} />
                        {text.avgExecutionTime}
                      </div>
                      <div className="text-primary/70 text-2xl font-bold">
                        {avgExecutionTime.toFixed(0)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{text.ms}</div>
                    </div>
                  </div>

                  <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <h3 className="mb-4 text-lg font-semibold text-slate-100">
                      {text.nodePerformance}
                    </h3>
                    <div className="space-y-3">
                      {topNodes.map((node, index) => (
                        <div key={node.id} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-xs font-bold text-slate-400">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-200">
                                {node.name}
                              </span>
                              <span className="text-xs text-slate-400">
                                {node.count} {text.executions}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-slate-400">
                                {node.avgTime.toFixed(0)} {text.ms}
                              </span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                                <div
                                  className={`h-full ${
                                    node.successRate > 80
                                      ? 'bg-green-500'
                                      : node.successRate > 50
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                  }`}
                                  style={{ width: `${node.successRate}%` }}
                                />
                              </div>
                              <span
                                className={`font-medium ${
                                  node.successRate > 80
                                    ? 'text-green-400'
                                    : node.successRate > 50
                                      ? 'text-yellow-400'
                                      : 'text-red-400'
                                }`}
                              >
                                {node.successRate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <h3 className="mb-4 text-lg font-semibold text-slate-100">{text.recent}</h3>
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {metrics
                        .slice(-10)
                        .reverse()
                        .map((metric, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between border-b border-slate-800 py-2 last:border-0"
                          >
                            <div className="flex items-center gap-3">
                              {metric.status === 'success' ? (
                                <CheckCircle size={16} className="text-green-500" />
                              ) : (
                                <XCircle size={16} className="text-red-500" />
                              )}
                              <span className="text-sm text-slate-200">{metric.nodeName}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>
                                {metric.executionTime} {text.ms}
                              </span>
                              <span>{new Date(metric.timestamp).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
