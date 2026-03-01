'use client';

import { useState, useEffect } from 'react';
import { Card, CardBody, Input, Textarea, Button, Badge, Chip } from "@heroui/react";
import { Zap, Search, HelpCircle, Info } from "lucide-react";

export default function RegexSolverPage() {
    const [regex, setRegex] = useState('(\\d+)');
    const [flags, setFlags] = useState('g');
    const [testText, setTestText] = useState('Hay 123 manzanas y 456 peras.');
    const [matches, setMatches] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            if (!regex) {
                setMatches([]);
                setError(null);
                return;
            }
            const re = new RegExp(regex, flags);
            const allMatches = Array.from(testText.matchAll(re));
            setMatches(allMatches);
            setError(null);
        } catch (e: any) {
            setError(e.message);
            setMatches([]);
        }
    }, [regex, flags, testText]);

    return (
        <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Zap className="text-yellow-500" /> Regex Solver
                </h1>
                <p className="text-default-500 mt-1">Prueba y depura tus expresiones regulares en tiempo real.</p>
            </div>

            <Card className="border border-white/10 bg-white/5">
                <CardBody className="p-6 space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-mono text-default-400 mb-1 block">EXPRESIÓN REGULAR</label>
                            <Input
                                value={regex}
                                onValueChange={setRegex}
                                placeholder="e.g. (\d+)"
                                startContent={<span className="text-default-400">/</span>}
                                endContent={<span className="text-default-400">/</span>}
                                color={error ? "danger" : "default"}
                                classNames={{ input: "font-mono" }}
                            />
                        </div>
                        <div className="w-24">
                            <label className="text-xs font-mono text-default-400 mb-1 block">FLAGS</label>
                            <Input
                                value={flags}
                                onValueChange={setFlags}
                                placeholder="gim"
                                classNames={{ input: "font-mono" }}
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-danger text-xs font-mono bg-danger/10 p-2 rounded-lg">{error}</p>
                    )}

                    <div>
                        <label className="text-xs font-mono text-default-400 mb-1 block">TEXTO DE PRUEBA</label>
                        <Textarea
                            value={testText}
                            onValueChange={setTestText}
                            placeholder="Escribe el texto donde buscar..."
                            variant="flat"
                            classNames={{
                                input: "font-mono text-sm min-h-[150px]",
                            }}
                        />
                    </div>
                </CardBody>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Search size={20} className="text-primary" /> Resultados ({matches.length})
                    </h2>
                    <div className="space-y-3">
                        {matches.length > 0 ? (
                            matches.map((match, i) => (
                                <Card key={i} className="border border-white/5 bg-white/5">
                                    <CardBody className="p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-default-400 uppercase">Match {i + 1}</span>
                                            <Chip size="sm" variant="flat" color="success">Índice: {match.index}</Chip>
                                        </div>
                                        <p className="font-mono text-lg text-white">
                                            {match[0]}
                                        </p>
                                        {match.length > 1 && (
                                            <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
                                                {Array.from(match).slice(1).map((group, j) => (
                                                    <div key={j} className="flex flex-col gap-1 p-2 bg-white/5 rounded-lg border border-white/5">
                                                        <span className="text-[10px] text-default-400 uppercase">Grupo {j + 1}</span>
                                                        <span className="text-sm font-mono text-blue-400 break-all">{group as string || "undefined"}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardBody>
                                </Card>
                            ))
                        ) : (
                            <div className="p-12 border-2 border-dashed border-white/10 rounded-2xl text-center text-default-400">
                                <HelpCircle className="mx-auto mb-2 opacity-20" size={48} />
                                No hay coincidencias con la expresión actual.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Info size={20} className="text-amber-500" /> Referencia rápida
                    </h2>
                    <Card className="border border-white/10 bg-white/5">
                        <CardBody className="p-4 space-y-4 text-sm">
                            <div>
                                <h3 className="font-bold text-default-300 mb-2 border-b border-white/10 pb-1">Básicos</h3>
                                <ul className="space-y-1 font-mono text-xs">
                                    <li><span className="text-yellow-500">.</span> - Cualquier carácter</li>
                                    <li><span className="text-yellow-500">\d</span> - Dígito (0-9)</li>
                                    <li><span className="text-yellow-500">\w</span> - Carácter alfanumérico</li>
                                    <li><span className="text-yellow-500">\s</span> - Espacio en blanco</li>
                                    <li><span className="text-yellow-500">^</span> - Inicio de línea</li>
                                    <li><span className="text-yellow-500">$</span> - Fin de línea</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-bold text-default-300 mb-2 border-b border-white/10 pb-1">Cuantificadores</h3>
                                <ul className="space-y-1 font-mono text-xs">
                                    <li><span className="text-yellow-500">*</span> - 0 o más</li>
                                    <li><span className="text-yellow-500">+</span> - 1 o más</li>
                                    <li><span className="text-yellow-500">?</span> - 0 o 1 (opcional)</li>
                                    <li><span className="text-yellow-500">{`{n}`}</span> - Exactamente n</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-bold text-default-300 mb-2 border-b border-white/10 pb-1">Grupos</h3>
                                <ul className="space-y-1 font-mono text-xs">
                                    <li><span className="text-yellow-500">(...)</span> - Grupo de captura</li>
                                    <li><span className="text-yellow-500">(?:...)</span> - Grupo no-captura</li>
                                    <li><span className="text-yellow-500">[a-z]</span> - Rango de caracteres</li>
                                </ul>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}
