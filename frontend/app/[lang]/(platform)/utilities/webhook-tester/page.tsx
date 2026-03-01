'use client';

import { useState } from 'react';
import { Card, CardBody, Button, Input, Select, SelectItem, Tabs, Tab, Textarea, Code, Badge } from "@heroui/react";
import { Globe, Send, RefreshCw, Clock, ChevronRight, Play } from "lucide-react";
import { toast } from "sonner";

export default function WebhookTesterPage() {
    const [method, setMethod] = useState("POST");
    const [url, setUrl] = useState("https://api.nanoflow.io/v1/webhook/test-id");
    const [headers, setHeaders] = useState([{ key: "Content-Type", value: "application/json" }]);
    const [body, setBody] = useState('{\n  "event": "user.signup",\n  "data": {\n    "id": 123,\n    "name": "John Doe"\n  }\n}');
    
    const [history, setLogs] = useState<any[]>([]);
    const [isSending, setIsSending] = useState(false);

    const addHeader = () => setHeaders([...headers, { key: "", value: "" }]);
    const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index));

    const simulateSend = () => {
        setIsSending(true);
        // Simular latencia
        setTimeout(() => {
            const newLog = {
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                method,
                status: 202,
                payload: JSON.parse(body),
                headers: Object.fromEntries(headers.map(h => [h.key, h.value]))
            };
            setLogs([newLog, ...history]);
            setIsSending(false);
            toast.success("Webhook procesado exitosamente");
        }, 800);
    };

    return (
        <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Globe className="text-orange-500" /> Webhook Tester
                    </h1>
                    <p className="text-default-500 mt-1">Prueba cómo tus servicios externos se integran con NanoFlow.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border border-white/10 bg-white/5">
                        <CardBody className="p-6 space-y-4">
                            <div className="flex gap-2">
                                <div className="w-32">
                                    <Select 
                                        selectedKeys={[method]} 
                                        onSelectionChange={(keys) => setMethod(Array.from(keys)[0] as string)}
                                    >
                                        <SelectItem key="POST">POST</SelectItem>
                                        <SelectItem key="GET">GET</SelectItem>
                                        <SelectItem key="PUT">PUT</SelectItem>
                                        <SelectItem key="PATCH">PATCH</SelectItem>
                                    </Select>
                                </div>
                                <Input 
                                    value={url} 
                                    onValueChange={setUrl}
                                    placeholder="Webhook URL"
                                    fullWidth
                                />
                                <Button 
                                    color="primary" 
                                    onPress={simulateSend} 
                                    isLoading={isSending}
                                    startContent={!isSending && <Send size={18} />}
                                >
                                    Enviar
                                </Button>
                            </div>

                            <Tabs variant="underlined" color="primary">
                                <Tab key="body" title="Body">
                                    <div className="pt-4">
                                        <Textarea
                                            value={body}
                                            onValueChange={setBody}
                                            minRows={8}
                                            classNames={{ input: "font-mono text-sm" }}
                                        />
                                    </div>
                                </Tab>
                                <Tab key="headers" title="Headers">
                                    <div className="pt-4 space-y-2">
                                        {headers.map((h, i) => (
                                            <div key={i} className="flex gap-2">
                                                <Input 
                                                    size="sm" 
                                                    placeholder="Key" 
                                                    value={h.key} 
                                                    onValueChange={(v) => {
                                                        const newH = [...headers];
                                                        newH[i].key = v;
                                                        setHeaders(newH);
                                                    }}
                                                />
                                                <Input 
                                                    size="sm" 
                                                    placeholder="Value" 
                                                    value={h.value}
                                                    onValueChange={(v) => {
                                                        const newH = [...headers];
                                                        newH[i].value = v;
                                                        setHeaders(newH);
                                                    }}
                                                />
                                                <Button size="sm" color="danger" variant="flat" onPress={() => removeHeader(i)}>×</Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="flat" onPress={addHeader}>+ Añadir Header</Button>
                                    </div>
                                </Tab>
                            </Tabs>
                        </CardBody>
                    </Card>

                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Clock size={20} className="text-default-400" /> Historial de Pruebas
                        </h2>
                        {history.map((log) => (
                            <Card key={log.id} className="border border-white/5 bg-white/5">
                                <CardBody className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3 items-center">
                                            <Badge color="success" variant="flat" className="font-mono">{log.status}</Badge>
                                            <span className="font-bold text-sm">{log.method}</span>
                                            <span className="text-xs text-default-400">{log.time}</span>
                                        </div>
                                        <Button size="sm" variant="light" isIconOnly><ChevronRight size={16} /></Button>
                                    </div>
                                    <div className="mt-3 bg-black/20 p-3 rounded-lg overflow-auto max-h-40">
                                        <pre className="text-[10px] font-mono text-green-500/80">
                                            {JSON.stringify(log.payload, null, 2)}
                                        </pre>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                        {history.length === 0 && (
                            <div className="p-12 border-2 border-dashed border-white/10 rounded-2xl text-center text-default-400">
                                No se han realizado envíos de prueba aún.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <Card className="border border-amber-500/20 bg-amber-500/5">
                        <CardBody className="p-4 space-y-3">
                            <h3 className="font-bold text-amber-400 flex items-center gap-2">
                                <Play size={16} /> NanoFlow Preview
                            </h3>
                            <p className="text-xs text-default-400 leading-relaxed">
                                Así es como se verían los datos dentro de un nodo de NanoFlow:
                            </p>
                            <div className="space-y-2">
                                <div className="p-2 bg-black/40 rounded border border-white/10">
                                    <p className="text-[10px] text-default-500 mb-1 uppercase font-mono">Variable</p>
                                    <code className="text-xs text-blue-400 break-all">{`{{ $json.body.event }}`}</code>
                                    <p className="text-[10px] text-green-500 mt-1">Value: "{history[0]?.payload?.event || "..."}"</p>
                                </div>
                                <div className="p-2 bg-black/40 rounded border border-white/10">
                                    <p className="text-[10px] text-default-500 mb-1 uppercase font-mono">Variable</p>
                                    <code className="text-xs text-blue-400 break-all">{`{{ $json.body.data.id }}`}</code>
                                    <p className="text-[10px] text-green-500 mt-1">Value: {history[0]?.payload?.data?.id || "..."}</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="border border-white/10 bg-white/5">
                        <CardBody className="p-4">
                            <h3 className="font-bold text-white mb-2 uppercase text-xs tracking-wider">Instrucciones</h3>
                            <ul className="text-xs text-default-400 space-y-2 list-disc pl-4">
                                <li>Configura el método HTTP deseado.</li>
                                <li>Ajusta los headers (usualmente application/json).</li>
                                <li>Define el payload en formato JSON.</li>
                                <li>Presiona "Enviar" para ver cómo NanoFlow lo interpretaría.</li>
                            </ul>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}
