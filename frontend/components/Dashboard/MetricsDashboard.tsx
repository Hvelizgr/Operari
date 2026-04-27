'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  CheckCircle,
  Clock,
  TrendingUp,
  X,
  XCircle,
  Zap,
  Activity,
  Timer,
} from 'lucide-react';
import { useState } from 'react';
import { StaggeredMetricCard } from './StaggeredMetricCard';

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
          className="absolute left-1/2 top-4 z-40 flex translate-x-24 items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-2 text-sm font-bold text-[var(--text-primary)] shadow-xl transition-all hover:scale-105 hover:border-[var(--accent-color)]"
        >
          <Activity size={16} className="text-[var(--accent-color)]" />
          {text.title}
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              className="marketing-shell relative h-full max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--app-bg)] p-8 shadow-2xl"
              initial={{ scale: 0.9, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            >
              {/* Header */}
              <div className="mb-10 flex items-center justify-between">
                <div>
                  <div className="m-eyebrow mb-2">Analytics</div>
                  <h2 className="text-4xl font-black tracking-tighter text-[var(--text-primary)]">
                    {text.title}
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full bg-[var(--panel-elevated)] p-3 text-[var(--text-muted)] transition-all hover:scale-110 hover:text-[var(--text-primary)]"
                >
                  <X size={24} />
                </button>
              </div>

              {totalExecutions === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--panel-border)] py-12 text-center text-[var(--text-muted)]">
                  <Activity size={48} className="mb-4 opacity-20" />
                  {text.noData}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Metric Cards Grid */}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <StaggeredMetricCard
                      label={text.totalExecutions}
                      value={totalExecutions}
                      suffix={text.executions}
                      icon={<Zap size={20} />}
                      delay={100}
                    />

                    <StaggeredMetricCard
                      label={text.successRate}
                      value={successRate}
                      suffix="%"
                      subValue={`${successCount} / ${totalExecutions}`}
                      icon={<CheckCircle size={20} />}
                      delay={200}
                    />

                    <StaggeredMetricCard
                      label={text.avgExecutionTime}
                      value={avgExecutionTime}
                      suffix={text.ms}
                      icon={<Timer size={20} />}
                      delay={300}
                    />
                  </div>

                  {/* Performance Section */}
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 400 }}
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-sm"
                    >
                      <h3 className="mb-6 flex items-center gap-2 text-xl font-black tracking-tight text-[var(--text-primary)]">
                        <BarChart3 size={20} className="text-[var(--accent-color)]" />
                        {text.nodePerformance}
                      </h3>
                      <div className="space-y-6">
                        {topNodes.map((node, index) => (
                          <div key={node.id} className="group flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-elevated)] text-sm font-black text-[var(--text-muted)] transition-all group-hover:bg-[var(--accent-color)] group-hover:text-black">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-bold text-[var(--text-primary)]">
                                  {node.name}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                                  {node.count} {text.executions}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs">
                                <span className="w-12 font-mono text-[var(--text-muted)]">
                                  {node.avgTime.toFixed(0)}ms
                                </span>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel-elevated)]">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${node.successRate}%` }}
                                    transition={{
                                      duration: 1.5,
                                      delay: 600 + index * 100,
                                      ease: 'easeOutExpo',
                                    }}
                                    className={`h-full ${
                                      node.successRate > 80
                                        ? 'bg-[var(--op-moss)]'
                                        : node.successRate > 50
                                          ? 'bg-[var(--op-gold)]'
                                          : 'bg-[var(--op-sunset)]'
                                    }`}
                                  />
                                </div>
                                <span
                                  className={`w-10 text-right font-black ${
                                    node.successRate > 80
                                      ? 'text-[var(--op-moss)]'
                                      : node.successRate > 50
                                        ? 'text-[var(--op-gold)]'
                                        : 'text-[var(--op-sunset)]'
                                  }`}
                                >
                                  {node.successRate.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Recent Executions */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 500 }}
                      className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-sm"
                    >
                      <h3 className="mb-6 flex items-center gap-2 text-xl font-black tracking-tight text-[var(--text-primary)]">
                        <Clock size={20} className="text-[var(--accent-color)]" />
                        {text.recent}
                      </h3>
                      <div className="custom-scrollbar max-h-[360px] space-y-3 overflow-y-auto pr-2">
                        {metrics
                          .slice(-12)
                          .reverse()
                          .map((metric, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 600 + index * 50 }}
                              className="hover:border-[var(--accent-color)]/30 flex items-center justify-between rounded-xl border border-[var(--panel-border)] bg-[var(--app-bg)] p-4 transition-all hover:scale-[1.02]"
                            >
                              <div className="flex items-center gap-4">
                                <div
                                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                    metric.status === 'success'
                                      ? 'bg-green-500/10 text-green-500'
                                      : 'bg-red-500/10 text-red-500'
                                  }`}
                                >
                                  {metric.status === 'success' ? (
                                    <CheckCircle size={16} />
                                  ) : (
                                    <XCircle size={16} />
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-[var(--text-primary)]">
                                    {metric.nodeName}
                                  </div>
                                  <div className="font-mono text-[10px] text-[var(--text-muted)]">
                                    {new Date(metric.timestamp).toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-sm font-black text-[var(--text-primary)]">
                                  {metric.executionTime}ms
                                </div>
                              </div>
                            </motion.div>
                          ))}
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
