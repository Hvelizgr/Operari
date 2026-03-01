'use client';

import { useState, useRef } from 'react';
import { Card, CardBody, Button, Chip, Badge } from "@heroui/react";
import { Code, Play, Trash2, Terminal as TerminalIcon, AlertCircle, Info } from "lucide-react";

export default function CodePlaygroundPage() {
    const [code, setCode] = useState(`// Escribe tu JavaScript aquí
const data = [
  { id: 1, name: "Nano", type: "Flow" },
  { id: 2, name: "Node", type: "Logic" }
];

console.log("Filtrando datos...");
const result = data.filter(item => item.id > 1);

return result;`);
    const [logs, setLogs] = useState<string[]>([]);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const runCode = () => {
        setLogs([]);
        setResult(null);
        setError(null);

        const customConsole = {
            log: (...args: any[]) => {
                setLogs(prev => [...prev, args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ')]);
            },
            error: (...args: any[]) => {
                setLogs(prev => [...prev, `ERROR: ${args.join(' ')}`]);
            }
        };

        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function('console', code);
            const output = fn(customConsole);
            setResult(output);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const clearAll = () => {
        setLogs([]);
        setResult(null);
        setError(null);
    };

    return (
        <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Code className="text-purple-500" /> Code Playground
                    </h1>
                    <p className="text-default-500 mt-1">Entorno de pruebas para lógica de nodos personalizados.</p>
                </div>
                <div className="flex gap-2">
                    <Button color="success" onPress={runCode} startContent={<Play size={18} />}>
                        Ejecutar (Ctrl+Enter)
                    </Button>
                    <Button variant="flat" color="danger" isIconOnly onPress={clearAll}>
                        <Trash2 size={18} />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-250px)]">
                <Card className="border border-white/10 bg-white/5">
                    <CardBody className="p-0">
                        <div className="flex justify-between items-center p-3 border-b border-white/10 bg-white/5">
                            <div className="flex gap-2">
                                <Chip size="sm" variant="flat" color="warning">JavaScript</Chip>
                                <Chip size="sm" variant="flat" color="default" className="opacity-50 italic">Python (Coming soon)</Chip>
                            </div>
                        </div>
                        <textarea
                            className="w-full h-full bg-transparent p-4 font-mono text-sm outline-none resize-none text-blue-300"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.ctrlKey && e.key === 'Enter') runCode();
                            }}
                            spellCheck={false}
                        />
                    </CardBody>
                </Card>

                <div className="flex flex-col gap-6 overflow-hidden">
                    <Card className="border border-white/10 bg-black/40 flex-1 overflow-hidden">
                        <CardBody className="p-0 flex flex-col">
                            <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-white/5">
                                <TerminalIcon size={14} className="text-default-400" />
                                <span className="text-xs font-mono uppercase text-default-400">Consola / Logs</span>
                            </div>
                            <div className="flex-1 p-4 font-mono text-xs overflow-auto space-y-1">
                                {logs.length === 0 && !error && !result && (
                                    <span className="text-default-500 italic opacity-50">Esperando ejecución...</span>
                                )}
                                {logs.map((log, i) => (
                                    <div key={i} className="text-default-300 border-l-2 border-primary/30 pl-2">
                                        <span className="text-primary/50 mr-2">{'>'}</span>
                                        {log}
                                    </div>
                                ))}
                                {error && (
                                    <div className="flex gap-2 text-danger bg-danger/10 p-2 rounded-lg mt-2 border border-danger/20">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                )}
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="border border-white/10 bg-white/5 h-1/3 overflow-hidden">
                        <CardBody className="p-0 flex flex-col">
                            <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-white/5">
                                <span className="text-xs font-mono uppercase text-default-400 italic">Resultado (Return)</span>
                            </div>
                            <div className="flex-1 p-4 font-mono text-sm overflow-auto text-green-400">
                                {result !== null ? (
                                    <pre>{JSON.stringify(result, null, 2)}</pre>
                                ) : (
                                    <span className="text-default-500 opacity-50">Null</span>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}
