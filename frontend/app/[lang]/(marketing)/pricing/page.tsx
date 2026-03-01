'use client';

import { Card, CardBody, CardHeader, Button, Tooltip, Chip } from "@heroui/react";
import { Check, Shield, GraduationCap, Stethoscope, Building2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { content as contentEn } from '@/app/[lang]/content/en';
import { content as contentEs } from '@/app/[lang]/content/es';

import { use } from 'react';
import { GridPattern } from "@/components/ui/GridPattern";

export default function PricingPage({ params }: { params: Promise<{ lang: string }> }) {
    const router = useRouter();
    const { lang } = use(params);

    const handleSubscribe = (plan: string) => {
        router.push(`/${lang}/login?plan=${plan}`);
    };

    // Note: Ideally we move this text to content files for full i18n, 
    // but for this task we hardcode the new strategy here.
    const isEs = lang === 'es';

    const text = {
        title: isEs ? "Planes para cada Rol" : "Plans for every Role",
        subtitle: isEs ? "Desde diagnóstico de flujos hasta gobernanza corporativa." : "From workflow diagnostics to corporate governance.",
        student: isEs ? "Dev / Free" : "Student / Free",
        edu: isEs ? "Escuelas / Pro" : "Education / Pro",
        corp: isEs ? "Gobierno IT" : "IT Governance",
        ctaFree: isEs ? "Empezar Gratis" : "Start Free",
        ctaEdu: isEs ? "Prueba para Aulas" : "Try for Classrooms",
        ctaCorp: isEs ? "Contactar Ventas" : "Contact Sales",
    };

    const plans = [
        {
            id: "student",
            name: text.student,
            price: "$0",
            period: "/forever",
            desc: isEs ? "Diagnóstico básico y backups para usuarios individuales de n8n." : "Basic diagnostics and backups for individual n8n users.",
            icon: <Stethoscope size={32} className="text-green-500" />,
            features: [
                isEs ? "Doctor de Flujos (Básico)" : "Workflow Doctor (Basic)",
                isEs ? "Snapshots Locales" : "Local Snapshots",
                isEs ? "1 Conexión n8n" : "1 n8n Connection",
                isEs ? "Comunidad Discord" : "Community Discord"
            ],
            cta: text.ctaFree,
            highlight: false
        },
        {
            id: "pro", // Mapping 'pro' to Education/Classroom
            name: text.edu,
            price: "$12",
            period: "/student/mo",
            desc: isEs ? "Automatice la corrección de tareas y gestione su aula." : "Automate grading assignments and manage your classroom.",
            icon: <GraduationCap size={32} className="text-blue-500" />,
            features: [
                isEs ? "Modo Aula (Roles)" : "Classroom Mode (Roles)",
                isEs ? "Auto-Corrector de Tareas" : "Auto-Grader for Tasks",
                isEs ? "Login Multi-usuario" : "Multi-user Login",
                isEs ? "30 Estudiantes / Clase" : "30 Students / Class",
                isEs ? "Librería de Plantillas" : "Template Library"
            ],
            cta: text.ctaEdu,
            highlight: false
        },
        {
            id: "growth", // New SME/Agency Plan
            name: isEs ? "PyMEs / Agencias" : "SMEs / Agencies",
            price: "$49",
            period: "/mo",
            desc: isEs ? "Gestione múltiples clientes y equipos con alertas de negocio." : "Manage multiple clients and teams with business alerts.",
            icon: <Building2 size={32} className="text-orange-500" />,
            features: [
                isEs ? "Carpetas de Clientes" : "Client Workspaces",
                isEs ? "Alertas de Negocio (SLA)" : "Business SLA Alerts",
                isEs ? "Reportes PDF Semanales" : "Weekly PDF Reports",
                isEs ? "5 Usuarios Admin" : "5 Admin Users",
                isEs ? "Historial 90 Días" : "90 Days History"
            ],
            cta: isEs ? "Empezar Growth" : "Start Growth",
            highlight: true
        },
        {
            id: "enterprise",
            name: text.corp,
            price: "Custom",
            period: "",
            desc: isEs ? "Control total, seguridad y cumplimiento para equipos DevOps." : "Total control, security, and compliance for DevOps teams.",
            icon: <Shield size={32} className="text-purple-500" />,
            features: [
                isEs ? "Logs de Auditoría Ilimitados" : "Unlimited Audit Logs",
                isEs ? "Políticas (Policy-as-Code)" : "Policy-as-Code Engine",
                isEs ? "SSO (SAML/OIDC)" : "SSO (SAML/OIDC)",
                isEs ? "Firewall de Nodos" : "Node Firewall",
                isEs ? "SLA 99.99%" : "99.99% SLA"
            ],
            cta: text.ctaCorp,
            highlight: false
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
             {/* Background Effects */}
             <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <GridPattern
                    width={50}
                    height={50}
                    x={-1}
                    y={-1}
                    strokeDasharray="4 2"
                    className="stroke-gray-500/10 [mask-image:radial-gradient(1000px_circle_at_center,white,transparent)]"
                />
            </div>
            <div className="pt-32 pb-20 px-4 max-w-7xl mx-auto relative z-10">
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-6">
                        {text.title}
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        {text.subtitle}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 max-w-[1400px] mx-auto">
                    {plans.map((plan, i) => (
                        <div key={i} className="relative group">
                            {/* Glow Effect for Highlighted Plan */}
                            {plan.highlight && (
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-pink-600 blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-[2rem]" />
                            )}
                            
                            <Card
                                className={`
                                    h-full p-8 border bg-[#09090b] relative overflow-hidden transition-all duration-300
                                    ${plan.highlight 
                                        ? 'border-orange-500/50 shadow-2xl shadow-orange-900/20 scale-[1.02] z-10' 
                                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
                                    rounded-[2rem]
                                `}
                            >
                                {plan.highlight && (
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                                            <Sparkles size={10} /> Popular
                                        </div>
                                    </div>
                                )}

                                <CardHeader className="flex flex-col items-start gap-6 pb-0 px-0">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${plan.highlight ? 'bg-orange-500/20 text-orange-500' : 'bg-white/5 text-gray-400'} transition-colors`}>
                                        {plan.icon}
                                    </div>
                                    <div className="w-full">
                                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                                        <p className="text-sm text-gray-400 mt-2 min-h-[40px] leading-relaxed font-light">{plan.desc}</p>
                                    </div>
                                </CardHeader>

                                <CardBody className="py-8 px-0 flex flex-col flex-1">
                                    <div className="flex items-baseline gap-1 mb-8">
                                        <span className="text-5xl font-bold text-white tracking-tight">{plan.price}</span>
                                        {plan.period && <span className="text-gray-500 font-medium text-sm">{plan.period}</span>}
                                    </div>

                                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full mb-8" />

                                    <ul className="space-y-4 mb-8 flex-1">
                                        {plan.features.map((feat, j) => (
                                            <li key={j} className="flex items-start gap-3 text-sm group/item">
                                                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.highlight ? 'bg-orange-500/20 text-orange-500' : 'bg-white/10 text-gray-500 group-hover/item:text-white group-hover/item:bg-white/20'} transition-colors`}>
                                                    <Check size={10} strokeWidth={3} />
                                                </div>
                                                <span className="text-gray-300 font-light">{feat}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    
                                    <Button
                                        className={`w-full font-bold h-12 rounded-xl text-md transition-all mt-auto ${
                                            plan.highlight 
                                                ? 'bg-gradient-to-r from-orange-600 to-pink-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:brightness-110' 
                                                : 'bg-white text-black hover:bg-gray-200'
                                        }`}
                                        variant="solid"
                                        onPress={() => handleSubscribe(plan.id)}
                                    >
                                        {plan.cta}
                                    </Button>
                                </CardBody>
                            </Card>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
