'use client';

import { useState } from 'react';
import { Card, CardBody, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Chip } from "@heroui/react";
import { Database, Play, Trash2, Save, FileText, Search, Info } from "lucide-react";
import { toast } from "sonner";

export default function SqlStudioPage() {
    const [query, setQuery] = useState("SELECT * FROM workflows WHERE isActive = true LIMIT 5;");
    const [results, setResult] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);

    const executeQuery = () => {
        setIsExecuting(true);
        // Simular ejecución de query en base de datos
        setTimeout(() => {
            const mockData = [
                { id: "wf_1", name: "Sync CRM", isActive: true, createdAt: "2024-01-20" },
                { id: "wf_2", name: "Data Backup", isActive: true, createdAt: "2024-01-21" },
                { id: "wf_3", name: "Notification Hub", isActive: true, createdAt: "2024-01-22" },
            ];
            
            if (query.toLowerCase().includes("workflows")) {
                setResult(mockData);
                setColumns(Object.keys(mockData[0]));
            } else {
                setResult([{ message: "Query ejecutada pero no se encontraron resultados o la tabla no existe en el sandbox." }]);
                setColumns(["message"]);
            }
            
            setIsExecuting(false);
            toast.success("Query ejecutada con éxito");
        }, 1000);
    };

    return (
        <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Database className="text-pink-500" /> SQL Studio
                    </h1>
                    <p className="text-default-500 mt-1">Explora y consulta tus bases de datos integradas en tiempo real.</p>
                </div>
                <div className="flex gap-2">
                    <Button color="primary" onPress={executeQuery} isLoading={isExecuting} startContent={<Play size={18} />}>
                        Ejecutar Query
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="space-y-4">
                    <h3 className="font-bold text-sm text-default-400 uppercase tracking-widest px-2">Explorador</h3>
                    <Card className="border border-white/10 bg-white/5">
                        <CardBody className="p-2">
                            <div className="space-y-1">
                                <div className="p-2 hover:bg-white/5 rounded-lg cursor-pointer flex items-center gap-2 text-sm text-default-300">
                                    <FileText size={14} className="text-blue-400" /> workflows
                                </div>
                                <div className="p-2 hover:bg-white/5 rounded-lg cursor-pointer flex items-center gap-2 text-sm text-default-300 opacity-50">
                                    <FileText size={14} /> executions
                                </div>
                                <div className="p-2 hover:bg-white/5 rounded-lg cursor-pointer flex items-center gap-2 text-sm text-default-300 opacity-50">
                                    <FileText size={14} /> credentials
                                </div>
                                <div className="p-2 hover:bg-white/5 rounded-lg cursor-pointer flex items-center gap-2 text-sm text-default-300 opacity-50">
                                    <FileText size={14} /> users
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    
                    <Card className="border border-blue-500/20 bg-blue-500/5">
                        <CardBody className="p-4 space-y-2">
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                                <Info size={14} /> MODO SANDBOX
                            </div>
                            <p className="text-[10px] text-blue-200/70 leading-relaxed">
                                Actualmente estás en el entorno de pruebas. Para consultar bases de datos reales, configura una conexión en el nodo SQL del editor.
                            </p>
                        </CardBody>
                    </Card>
                </div>

                <div className="lg:col-span-3 space-y-6">
                    <Card className="border border-white/10 bg-black/40">
                        <CardBody className="p-0">
                            <textarea
                                className="w-full min-h-[200px] bg-transparent p-6 font-mono text-sm outline-none resize-y text-pink-200"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                spellCheck={false}
                            />
                        </CardBody>
                    </Card>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Search size={20} className="text-default-400" /> Resultados
                            </h2>
                            {results.length > 0 && (
                                <Chip size="sm" variant="flat">{results.length} filas</Chip>
                            )}
                        </div>

                        <Card className="border border-white/10 bg-white/5 overflow-hidden">
                            <CardBody className="p-0">
                                {results.length > 0 ? (
                                    <Table aria-label="Resultados SQL" removeWrapper className="min-w-full">
                                        <TableHeader>
                                            {columns.map(col => (
                                                <TableColumn key={col}>{col.toUpperCase()}</TableColumn>
                                            ))}
                                        </TableHeader>
                                        <TableBody>
                                            {results.map((row, i) => (
                                                <TableRow key={i}>
                                                    {columns.map(col => (
                                                        <TableCell key={col} className="font-mono text-xs py-3 border-b border-white/5">
                                                            {String(row[col])}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="p-20 text-center text-default-500 italic">
                                        Ejecuta una query para ver los resultados aquí.
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
