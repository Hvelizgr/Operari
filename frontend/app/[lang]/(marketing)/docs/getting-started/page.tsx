'use client';

import { use } from 'react';
import { motion } from "framer-motion";
import { ArrowLeft, Terminal, CheckCircle2, Server, Globe } from "lucide-react";
import Link from 'next/link';

export default function GettingStartedPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = use(params);
    const isEs = lang === 'es';

    const content = {
        title: isEs ? "Primeros Pasos con NanoFlow" : "Getting Started with NanoFlow",
        subtitle: isEs 
            ? "Instala y configura tu entorno de orquestación en menos de 5 minutos." 
            : "Install and configure your orchestration environment in less than 5 minutes.",
        steps: [
            {
                title: isEs ? "1. Prerrequisitos" : "1. Prerequisites",
                description: isEs 
                    ? "Asegúrate de tener Docker y Docker Compose instalados en tu sistema."
                    : "Ensure you have Docker and Docker Compose installed on your system.",
                code: "docker --version\ndocker-compose --version"
            },
            {
                title: isEs ? "2. Clonar el repositorio" : "2. Clone the repository",
                description: isEs
                    ? "Descarga el código fuente oficial de NanoFlow."
                    : "Download the official NanoFlow source code.",
                code: "git clone https://github.com/Hvelizgr/NanoFlow.git\ncd NanoFlow"
            },
            {
                title: isEs ? "3. Iniciar Servicios" : "3. Start Services",
                description: isEs
                    ? "Levanta la infraestructura completa (Frontend, Backend, Postgres, Redis)."
                    : "Spin up the full infrastructure (Frontend, Backend, Postgres, Redis).",
                code: "npm install\nnpm run dev"
            },
             {
                title: isEs ? "4. Acceder al Panel" : "4. Access Dashboard",
                description: isEs
                    ? "Abre tu navegador y comienza a orquestar."
                    : "Open your browser and start orchestrating.",
                link: "http://localhost:3000"
            }
        ]
    };

    return (
        <div className="min-h-screen bg-black text-white pt-32 pb-20 relative">
             <div className="max-w-4xl mx-auto px-6 relative z-10">
                <Link href={`/${lang}/docs`} className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={20} />
                    {isEs ? "Volver a Documentación" : "Back to Docs"}
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                        {content.title}
                    </h1>
                    <p className="text-xl text-gray-400 mb-12 leading-relaxed">
                        {content.subtitle}
                    </p>

                    <div className="space-y-12">
                        {content.steps.map((step, idx) => (
                            <div key={idx} className="relative border-l-2 border-white/10 pl-8 pb-4">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 box-content border-4 border-black" />
                                
                                <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-3">
                                    {step.title}
                                </h2>
                                <p className="text-gray-400 mb-6 text-lg">
                                    {step.description}
                                </p>

                                {step.code && (
                                    <div className="bg-[#1e1e1e] rounded-xl p-6 border border-white/10 group relative overflow-hidden">
                                        <div className="absolute top-3 right-3 flex gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                                        </div>
                                        <pre className="font-mono text-sm text-blue-300 overflow-x-auto">
                                            {step.code}
                                        </pre>
                                    </div>
                                )}

                                {step.link && (
                                    <a 
                                        href={step.link} 
                                        target="_blank" 
                                        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-bold text-lg border-b border-blue-400/20 hover:border-blue-400 pb-0.5"
                                    >
                                        <Globe size={18} />
                                        {step.link}
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-16 p-6 rounded-2xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 flex items-start gap-4">
                        <CheckCircle2 className="text-blue-400 shrink-0 mt-1" size={24} />
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">
                                {isEs ? "¿Todo listo?" : "All Set?"}
                            </h3>
                            <p className="text-gray-400">
                                {isEs 
                                    ? "Ahora que tienes NanoFlow corriendo, es hora de conectar tus instancias de n8n." 
                                    : "Now that NanoFlow is running, it's time to connect your n8n instances."}
                            </p>
                            <Link 
                                href="#"
                                className="inline-block mt-4 px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                {isEs ? "Guía: Conectar n8n" : "Guide: Connect n8n"}
                            </Link>
                        </div>
                    </div>
                </motion.div>
             </div>
        </div>
    );
}
