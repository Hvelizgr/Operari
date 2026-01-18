'use client';

import { Card, CardBody, CardHeader, Button, Tooltip, Chip } from "@heroui/react";
import { Check, Shield, GraduationCap, Stethoscope, Building2 } from "lucide-react";
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
        student: isEs ? "Estudiante / Free" : "Student / Free",
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
                        <Card
                            key={i}
                            className={`
                                p-6 border-transparent bg-white/5 backdrop-blur-md h-full
                                ${plan.highlight ? 'ring-2 ring-orange-500 scale-105 shadow-2xl shadow-orange-500/20 z-10' : 'hover:scale-105 transition-transform border border-white/5 data-[hover=true]:border-white/10'}
                            `}
                        >
                            <CardHeader className="flex flex-col items-start gap-4 pb-0">
                                <div className="p-3 bg-white/5 rounded-xl">
                                    {plan.icon}
                                </div>
                                <div className="w-full">
                                    <div className="flex justify-between items-center">
                                         <h3 className="text-xl font-bold">{plan.name}</h3>
                                         {plan.highlight && <Chip size="sm" color="primary" variant="flat">Best Value</Chip>}
                                    </div>
                                    <p className="text-sm text-gray-400 mt-2 h-12 leading-relaxed">{plan.desc}</p>
                                </div>
                            </CardHeader>
                            <CardBody className="py-8">
                                <div className="flex items-end gap-1 mb-8">
                                    <span className="text-4xl font-bold">{plan.price}</span>
                                    {plan.period && <span className="text-gray-400 mb-1 font-mono text-sm">{plan.period}</span>}
                                </div>
                                <ul className="space-y-4 mb-8">
                                    {plan.features.map((feat, j) => (
                                        <li key={j} className="flex items-center gap-3 text-sm">
                                            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0">
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                            <span className="text-gray-300">{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    className="w-full font-bold"
                                    color={plan.highlight ? "warning" : "default"}
                                    variant={plan.highlight ? "solid" : "bordered"}
                                    size="lg"
                                    onClick={() => handleSubscribe(plan.id)}
                                >
                                    {plan.cta}
                                </Button>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
