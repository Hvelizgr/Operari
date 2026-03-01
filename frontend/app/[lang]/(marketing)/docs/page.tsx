'use client';

import { Card, CardBody, CardHeader, Button, Chip } from "@heroui/react";
import { BookOpen, Code, FileText, ArrowRight, Video, FileQuestion, Terminal } from "lucide-react";
import { use } from 'react';
import { motion } from "framer-motion";
import { GridPattern } from "@/components/ui/GridPattern";

export default function DocsPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = use(params);
    const isEs = lang === 'es';

    const text = {
        title: isEs ? "Documentación de NanoFlow" : "NanoFlow Documentation",
        subtitle: isEs ? "Aprende a integrar, gobernar y asegurar tus flujos de n8n." : "Learn to integrate, govern, and secure your n8n workflows.",
        sections: [
            {
                title: isEs ? "Primeros Pasos" : "Getting Started",
                icon: <BookOpen className="text-blue-400" />,
                links: [
                    { label: isEs ? "Instalación Rápida" : "Quick Installation", href: `/${lang}/docs/getting-started` },
                    { label: isEs ? "Conectando tu n8n" : "Connecting your n8n", href: "#" },
                    { label: isEs ? "Tu primer análisis" : "Your first analysis", href: "#" }
                ]
            },
            {
                title: isEs ? "Guías de API" : "API Guides",
                icon: <Code className="text-purple-400" />,
                links: [
                    { label: isEs ? "Autenticación" : "Authentication", href: "#" },
                    { label: isEs ? "Endpoints del Doctor" : "Doctor Endpoints", href: "#" },
                    { label: isEs ? "Webhooks" : "Webhooks", href: "#" }
                ]
            },
            {
                title: isEs ? "Gobernanza" : "Governance",
                icon: <FileText className="text-orange-400" />,
                links: [
                    { label: isEs ? "Crear Políticas" : "Creating Policies", href: "#" },
                    { label: isEs ? "Gestión de Usuarios" : "User Management", href: "#" },
                    { label: isEs ? "Logs de Auditoría" : "Audit Logs", href: "#" }
                ]
            }
        ],
        resources: {
            title: isEs ? "Recursos Adicionales" : "Additional Resources",
            items: [
                {
                    title: isEs ? "Video Tutoriales" : "Video Tutorials",
                    desc: isEs ? "Aprende viendo ejemplos reales paso a paso." : "Learn by watching real examples step-by-step.",
                    icon: <Video size={20} className="text-white" />,
                    color: "bg-red-500"
                },
                {
                    title: isEs ? "Preguntas Frecuentes" : "FAQ",
                    desc: isEs ? "Respuestas a las dudas más comunes." : "Answers to common questions.",
                    icon: <FileQuestion size={20} className="text-white" />,
                    color: "bg-green-500"
                },
                {
                    title: isEs ? "Referencia CLI" : "CLI Reference",
                    desc: isEs ? "Comandos para usuarios avanzados." : "Commands for power users.",
                    icon: <Terminal size={20} className="text-white" />,
                    color: "bg-gray-700"
                }
            ]
        }
    };

    return (
        <div className="min-h-screen bg-black text-white pt-32 pb-20 relative overflow-hidden">
             <div className="absolute inset-0 pointer-events-none z-0">
                 <GridPattern
                    width={50}
                    height={50}
                    x={-1}
                    y={-1}
                    className="stroke-gray-500/10 [mask-image:radial-gradient(1000px_circle_at_center,white,transparent)]"
                />
            </div>
            <div className="max-w-7xl mx-auto px-4 relative z-10">
                <div className="text-center mb-16">
                    <Chip variant="flat" color="primary" className="mb-4">Docs 1.0</Chip>
                    <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        {text.title}
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        {text.subtitle}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                    {text.sections.map((section, idx) => (
                        <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-xl">
                            <CardHeader className="flex items-center gap-3">
                                <div className="p-3 bg-white/5 rounded-lg">
                                    {section.icon}
                                </div>
                                <h2 className="text-xl font-bold">{section.title}</h2>
                            </CardHeader>
                            <CardBody>
                                <ul className="space-y-4">
                                    {section.links.map((link, i) => (
                                        <li key={i}>
                                            <a href={link.href} className="flex items-center justify-between text-gray-400 hover:text-white group transition-colors">
                                                <span>{link.label}</span>
                                                <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </CardBody>
                        </Card>
                    ))}
                </div>

                <h2 className="text-3xl font-bold mb-8 text-center">{text.resources.title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {text.resources.items.map((item, idx) => (
                        <motion.div 
                            key={idx}
                            whileHover={{ scale: 1.02 }}
                            className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-4 cursor-pointer hover:bg-white/10 transition-colors"
                        >
                            <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center shadow-lg`}>
                                {item.icon}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                                <p className="text-sm text-gray-400">{item.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
