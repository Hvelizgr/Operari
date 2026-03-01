'use client';

import Link from "next/link";
import { Card, CardBody, CardHeader, Button, Divider } from "@heroui/react";
import { Lock, Code, Database, Zap, FileJson, Globe } from "lucide-react";

import { useParams } from "next/navigation";

export default function UtilitiesPage() {
    const params = useParams();
    const lang = params.lang || 'en';

    const tools = [
        { icon: <Lock />, title: "Secure Vault", desc: "Gestor de credenciales encriptadas (AES-256).", color: "text-blue-500 bg-blue-500/20", href: `/${lang}/utilities/secure-vault` },
        { icon: <Code />, title: "Code Playground", desc: "Prueba scripts JS/Python en un entorno aislado.", color: "text-purple-500 bg-purple-500/20", href: `/${lang}/utilities/code-playground` },
        { icon: <FileJson />, title: "JSON Formatter", desc: "Validador y formateador de estructuras JSON complejas.", color: "text-green-500 bg-green-500/20", href: `/${lang}/utilities/json-formatter` },
        { icon: <Globe />, title: "Webhook Tester", desc: "Genera endpoints temporales para debug.", color: "text-orange-500 bg-orange-500/20", href: `/${lang}/utilities/webhook-tester` },
        { icon: <Database />, title: "SQL Studio", desc: "Conecta y consulta bases de datos temporalmente.", color: "text-pink-500 bg-pink-500/20", href: `/${lang}/utilities/sql-studio` },
        { icon: <Zap />, title: "Regex Solver", desc: "Ayudante para expresiones regulares de extracción.", color: "text-yellow-500 bg-yellow-500/20", href: `/${lang}/utilities/regex-solver` },
    ]

    return (
        <div className="p-8 space-y-8 max-w-[1200px] mx-auto">
            <div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-amber-600">
                    Utilidades y Herramientas
                </h1>
                <p className="text-default-500 mt-2">Kit de herramientas esenciales para desarrolladores de flujos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool, i) => (
                    <Link href={tool.href} key={i}>
                        <Card isPressable isHoverable className="p-4 border border-white/10 bg-white/5 backdrop-blur-md h-full w-full hover:scale-[1.02] transition-transform hover:bg-white/10">
                            <CardHeader className="flex gap-4">
                                <div className={`p-3 rounded-xl ${tool.color} backdrop-blur-sm bg-opacity-20`}>
                                    {tool.icon}
                                </div>
                            </CardHeader>
                            <CardBody className="pt-0 pb-4">
                                <h3 className="font-bold text-xl mb-2 text-white">{tool.title}</h3>
                                <p className="text-gray-400 text-sm">{tool.desc}</p>
                            </CardBody>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
