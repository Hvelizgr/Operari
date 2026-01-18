'use client';

import { Card, CardBody, Chip, Accordion, AccordionItem } from "@heroui/react";
import { Clock, CheckCircle2, XCircle, ChevronRight, Database, Zap, Bug } from "lucide-react";

interface TraceExplorerProps {
    nodeStatuses: Record<string, string>;
    nodeOutputs: Record<string, any>;
    logs: any[];
}

export default function TraceExplorer({ nodeStatuses, nodeOutputs, logs }: TraceExplorerProps) {
    // Intersect nodes that have started in order of appearance in logs if possible
    // For now, let's just list nodes and their outputs
    const executedNodeIds = Object.keys(nodeStatuses);

    if (executedNodeIds.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                <Zap size={24} className="opacity-20" />
                <p className="text-sm font-medium">No execution traceability data yet.</p>
                <p className="text-xs">Run the workflow to see the step-by-step trace.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <Accordion 
                variant="splitted" 
                className="px-0 gap-3"
                itemClasses={{
                    base: "bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden",
                    title: "text-sm font-bold text-slate-200",
                    subtitle: "text-[10px] text-slate-400 font-mono",
                    content: "bg-slate-900/50 p-4 border-t border-slate-700/30",
                    trigger: "px-4 py-3"
                }}
            >
                {executedNodeIds.map((nodeId) => {
                    const status = nodeStatuses[nodeId];
                    const output = nodeOutputs[nodeId];
                    const nodeName = logs.find(l => l.metadata?.nodeId === nodeId)?.message.split(': ')[1] || nodeId;

                    return (
                        <AccordionItem
                            key={nodeId}
                            aria-label={nodeName}
                            startContent={status === 'SUCCESS' ? <CheckCircle2 className="text-green-500" size={18} /> : 
                                         status === 'RUNNING' ? <Clock className="text-blue-500 animate-pulse" size={18} /> : 
                                         status === 'PAUSED' ? <Bug className="text-orange-500 animate-pulse" size={18} /> : 
                                         <XCircle className="text-red-500" size={18} />}
                            title={nodeName}
                            subtitle={`Node ID: ${nodeId}`}
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <Database size={12} /> Execution Output
                                    </h4>
                                    <Chip size="sm" variant="flat" color={status === 'SUCCESS' ? 'success' : status === 'PAUSED' ? 'warning' : 'danger'}>
                                        {status}
                                    </Chip>
                                </div>
                                
                                {output ? (
                                    <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                                        <pre className="text-[11px] font-mono text-blue-300 overflow-x-auto">
                                            {JSON.stringify(output, null, 2)}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="text-[11px] font-mono text-slate-500 italic">
                                        No output data captured for this step.
                                    </div>
                                )}
                            </div>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        </div>
    );
}
