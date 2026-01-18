'use client';

import { Button, Card, CardBody } from "@heroui/react";
import { Check, X, Minus } from "lucide-react";
import Link from 'next/link';
import { GridPattern } from "@/components/ui/GridPattern";
import { useParams } from 'next/navigation';

export default function ComparePage() {
    const params = useParams();
    const lang = params.lang || 'en';
    const isEs = lang === 'es';

    const text = {
        title: isEs ? "NanoFlow vs La Competencia" : "NanoFlow vs The Rest",
        subtitle: isEs 
            ? "Descubre por qué desarrolladores y equipos enterprise están cambiando de Zapier y n8n a NanoFlow."
            : "See why developers and enterprise teams are switching from Zapier and n8n to NanoFlow.",
        feature: isEs ? "Característica" : "Feature",
        rows: [
            { name: isEs ? "Auto-hospedable" : "Self-Hostable", nano: true, zap: false, n8n: true },
            { name: isEs ? "Depurador Visual" : "Visual Debugger", nano: true, zap: false, n8n: true },
            { name: isEs ? "No-Code y Código Mixto" : "No-Code & Code Mixed", nano: true, zap: false, n8n: true },
            { name: isEs ? "Colaboración en Tiempo Real" : "Real-time Collaboration", nano: true, zap: false, n8n: false },
            { name: isEs ? "Ramificación / Bucles" : "Branching / Loops", nano: true, zap: "Ltd", n8n: true },
            { name: isEs ? "Límite de Ejecución" : "Execution Time Limit", nano: isEs ? "Sin límite" : "Unlimited", zap: "2min", n8n: isEs ? "Sin límite" : "Unlimited" },
            { name: isEs ? "Precio (Pro)" : "Pricing (Pro)", nano: "$29/mo", zap: "$69/mo", n8n: "€20/mo" },
            { name: isEs ? "Nodos de IA Nativos" : "Native AI Nodes", nano: true, zap: true, n8n: true },
            { name: isEs ? "Cloud Soberano" : "Sovereign Cloud", nano: true, zap: false, n8n: false },
        ],
        ctaTitle: isEs ? "¿Listo para mejorar tu workflow?" : "Ready to upgrade your workflow?",
        ctaPrimary: isEs ? "Comenzar Gratis" : "Get Started Free",
        ctaSecondary: isEs ? "Hablar con Ventas" : "Talk to Sales",
    };

    const renderCell = (val: any, highlight = false) => {
        if (val === true) return <Check className={highlight ? "text-green-400 mx-auto" : "text-white mx-auto"} />;
        if (val === false) return <X className="text-gray-600 mx-auto" />;
        return <span className={highlight ? "text-blue-400 font-bold" : "text-gray-400"}>{val}</span>;
    };

    return (
        <div className="min-h-screen bg-black text-white pt-24 pb-20 px-4 relative overflow-hidden">
             <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                <GridPattern
                    width={40}
                    height={40}
                    x={-1}
                    y={-1}
                    className="stroke-blue-500/10 [mask-image:radial-gradient(1200px_circle_at_center,white,transparent)]"
                />
            </div>
            <div className="max-w-6xl mx-auto relative z-10">
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold mb-6">{text.title}</h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">{text.subtitle}</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="p-6 w-1/4">{text.feature}</th>
                                <th className="p-6 w-1/4 text-center bg-blue-500/10 rounded-t-xl border-t border-x border-blue-500/20">
                                    <span className="text-blue-400 font-bold text-xl">NanoFlow</span>
                                </th>
                                <th className="p-6 w-1/4 text-center text-gray-400">Zapier</th>
                                <th className="p-6 w-1/4 text-center text-gray-400">n8n</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {text.rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                    <td className="p-6 font-medium border-l border-transparent">{row.name}</td>
                                    <td className="p-6 text-center bg-blue-500/5 border-x border-blue-500/10">
                                        {renderCell(row.nano, true)}
                                    </td>
                                    <td className="p-6 text-center">{renderCell(row.zap)}</td>
                                    <td className="p-6 text-center">{renderCell(row.n8n)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-20 p-10 bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-3xl text-center border border-white/10">
                    <h2 className="text-3xl font-bold mb-6">{text.ctaTitle}</h2>
                    <div className="flex gap-4 justify-center">
                        <Link href={`/${lang}/pricing`}>
                            <Button size="lg" color="primary" className="font-bold shadow-lg shadow-blue-500/20">
                                {text.ctaPrimary}
                            </Button>
                        </Link>
                        <Link href={`/${lang}/login`}>
                            <Button size="lg" variant="bordered" className="font-bold text-white border-white/20 hover:bg-white/10">
                                {text.ctaSecondary}
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
