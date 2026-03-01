'use client';

import { useState } from 'react';
import { Card, CardBody, Button, Textarea, Tooltip } from "@heroui/react";
import { FileJson, Copy, Trash2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function JsonFormatterPage() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const formatJson = () => {
        try {
            if (!input.trim()) return;
            const parsed = JSON.parse(input);
            const formatted = JSON.stringify(parsed, null, 2);
            setOutput(formatted);
            setError(null);
        } catch (e: any) {
            setError(e.message);
            setOutput('');
        }
    };

    const minifyJson = () => {
        try {
            if (!input.trim()) return;
            const parsed = JSON.parse(input);
            const minified = JSON.stringify(parsed);
            setOutput(minified);
            setError(null);
        } catch (e: any) {
            setError(e.message);
            setOutput('');
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(output);
        setCopied(true);
        toast.success("Copiado al portapapeles");
        setTimeout(() => setCopied(false), 2000);
    };

    const clearAll = () => {
        setInput('');
        setOutput('');
        setError(null);
    };

    return (
        <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <FileJson className="text-green-500" /> JSON Formatter
                    </h1>
                    <p className="text-default-500 mt-1">Valida, formatea y minifica tus estructuras JSON.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="flat" color="danger" onPress={clearAll} startContent={<Trash2 size={18} />}>
                        Limpiar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-250px)]">
                <Card className="border border-white/10 bg-white/5">
                    <CardBody className="p-0">
                        <div className="flex justify-between items-center p-3 border-b border-white/10 bg-white/5">
                            <span className="text-xs font-mono uppercase text-default-400">Input</span>
                            <div className="flex gap-2">
                                <Button size="sm" color="success" variant="flat" onPress={formatJson}>Formatear</Button>
                                <Button size="sm" color="primary" variant="flat" onPress={minifyJson}>Minificar</Button>
                            </div>
                        </div>
                        <Textarea
                            placeholder="Pega tu JSON aquí..."
                            variant="flat"
                            classNames={{
                                inputWrapper: "bg-transparent h-full",
                                input: "font-mono text-sm leading-relaxed p-4 h-full resize-none",
                            }}
                            value={input}
                            onValueChange={setInput}
                            fullWidth
                            disableAutosize
                        />
                    </CardBody>
                </Card>

                <Card className="border border-white/10 bg-white/5 relative">
                    <CardBody className="p-0 flex flex-col h-full">
                        <div className="flex justify-between items-center p-3 border-b border-white/10 bg-white/5">
                            <span className="text-xs font-mono uppercase text-default-400">Output</span>
                            {output && (
                                <Button 
                                    size="sm" 
                                    variant="flat" 
                                    onPress={copyToClipboard}
                                    startContent={copied ? <Check size={14} /> : <Copy size={14} />}
                                >
                                    {copied ? "Copiado" : "Copiar"}
                                </Button>
                            )}
                        </div>
                        <div className="flex-1 p-4 font-mono text-sm overflow-auto whitespace-pre">
                            {error ? (
                                <div className="flex gap-3 text-danger bg-danger/10 p-4 rounded-xl items-start">
                                    <AlertCircle className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold">Error de parsing:</p>
                                        <p className="text-xs opacity-80 mt-1">{error}</p>
                                    </div>
                                </div>
                            ) : (
                                <code className="text-green-400">{output}</code>
                            )}
                            {!output && !error && (
                                <span className="text-default-300 italic">El resultado aparecerá aquí...</span>
                            )}
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
