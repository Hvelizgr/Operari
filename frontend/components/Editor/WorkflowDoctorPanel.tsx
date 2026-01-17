/**
 * WorkflowDoctorPanel - Component to display workflow issues
 * Shows errors, warnings, and suggestions from the Workflow Doctor
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle,
    AlertTriangle,
    Info,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Shield,
    Link2,
    Layers,
    Zap,
    X,
} from 'lucide-react';
import { WorkflowIssue, IssueSeverity, IssueCategory } from '../../hooks/useWorkflowDoctor';

interface WorkflowDoctorPanelProps {
    issues: WorkflowIssue[];
    errorCount: number;
    warningCount: number;
    infoCount: number;
    isHealthy: boolean;
    onNodeClick?: (nodeId: string) => void;
    onDismiss?: () => void;
}

const SEVERITY_ICONS: Record<IssueSeverity, typeof AlertCircle> = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const SEVERITY_COLORS: Record<IssueSeverity, string> = {
    error: 'text-red-500 bg-red-500/10 border-red-500/30',
    warning: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    info: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
};

const CATEGORY_ICONS: Record<IssueCategory, typeof Shield> = {
    connection: Link2,
    security: Shield,
    structure: Layers,
    performance: Zap,
    'best-practice': CheckCircle,
};

export default function WorkflowDoctorPanel({
    issues,
    errorCount,
    warningCount,
    infoCount,
    isHealthy,
    onNodeClick,
    onDismiss,
}: WorkflowDoctorPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

    const toggleIssue = (issueId: string) => {
        setExpandedIssues(prev => {
            const next = new Set(prev);
            if (next.has(issueId)) {
                next.delete(issueId);
            } else {
                next.add(issueId);
            }
            return next;
        });
    };

    if (issues.length === 0) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 right-4 z-50 w-80 max-h-96 bg-[var(--form-background-color)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden"
        >
            {/* Header */}
            <div
                className="flex items-center justify-between p-3 border-b border-[var(--border-color)] cursor-pointer hover:bg-[var(--table-header-background-color)] transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    {isHealthy ? (
                        <CheckCircle className="text-green-500" size={18} />
                    ) : (
                        <AlertTriangle className="text-amber-500" size={18} />
                    )}
                    <span className="font-semibold text-[var(--body-text-color)]">
                        Workflow Doctor
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Issue counts */}
                    {errorCount > 0 && (
                        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-500">
                            <AlertCircle size={12} />
                            {errorCount}
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500">
                            <AlertTriangle size={12} />
                            {warningCount}
                        </span>
                    )}
                    {infoCount > 0 && (
                        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500">
                            <Info size={12} />
                            {infoCount}
                        </span>
                    )}
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    {onDismiss && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDismiss();
                            }}
                            className="p-1 hover:bg-[var(--border-color)] rounded transition-colors"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Issues List */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-auto max-h-72"
                    >
                        <div className="p-2 space-y-2">
                            {issues.map((issue) => {
                                const SeverityIcon = SEVERITY_ICONS[issue.severity];
                                const CategoryIcon = CATEGORY_ICONS[issue.category];
                                const isIssueExpanded = expandedIssues.has(issue.id);

                                return (
                                    <div
                                        key={issue.id}
                                        className={`border rounded-lg overflow-hidden ${SEVERITY_COLORS[issue.severity]}`}
                                    >
                                        <div
                                            className="flex items-start gap-2 p-2 cursor-pointer hover:bg-white/5 transition-colors"
                                            onClick={() => toggleIssue(issue.id)}
                                        >
                                            <SeverityIcon size={16} className="mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <CategoryIcon size={12} className="opacity-60" />
                                                    <span className="text-xs font-medium">
                                                        {issue.message}
                                                    </span>
                                                </div>
                                            </div>
                                            {issue.nodeId && onNodeClick && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onNodeClick(issue.nodeId!);
                                                    }}
                                                    className="text-xs px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                                                >
                                                    Go to
                                                </button>
                                            )}
                                        </div>

                                        <AnimatePresence>
                                            {isIssueExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-white/10"
                                                >
                                                    <div className="p-2 text-xs space-y-2">
                                                        <p className="opacity-80">
                                                            {issue.description}
                                                        </p>
                                                        {issue.suggestion && (
                                                            <div className="flex items-start gap-1 p-1.5 rounded bg-white/5">
                                                                <Info size={12} className="mt-0.5 flex-shrink-0 opacity-60" />
                                                                <span className="opacity-70">
                                                                    {issue.suggestion}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}