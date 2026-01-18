'use client';

import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { ShieldAlert, FileSearch, LockKeyhole,  Activity, GraduationCap, Gavel } from "lucide-react";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { GridPattern } from '@/components/ui/GridPattern';

export default function FeaturesPage() {
    const params = useParams();
    const lang = params.lang || 'en';

    const isEs = lang === 'es';

    const texts = {
        badge: isEs ? "NUEVO: POLICY ENGINE 1.0" : "NEW: POLICY ENGINE 1.0",
        heroTitleStart: isEs ? "Controla lo que" : "Orchestrate,",
        heroTitleEnd: isEs ? "Ejecutas." : "Don't Just Automate.",
        heroSubtitle: isEs ? "Añade seguridad, auditoría y corrección automática a tus servidores n8n." : "Add security, auditing, and auto-grading layers to your n8n servers.",
        cta: isEs ? "Ver Planes" : "View Plans",
        
        featDocTitle: isEs ? "Workflow Doctor" : "Workflow Doctor",
        featDocDesc: isEs ? "Analiza tus flujos en busca de secretos expuestos (API Keys), nodos desconectados y cuellos de botella." : "Analyze your flows for exposed secrets (API Keys), disconnected nodes, and performance bottlenecks.",
        
        featEduTitle: isEs ? "Auto-Corrector" : "Auto-Grader",
        featEduDesc: isEs ? "Para profesores: Sube un caso de prueba (Input/Output). NanoFlow califica a tus alumnos automáticamente." : "For teachers: Upload a test case (Input/Output). NanoFlow grades your students automatically.",
        
        featGovTitle: isEs ? "Firewall de Nodos" : "Node Firewall",
        featGovDesc: isEs ? "Bloquea nodos peligrosos (ej: 'Execute Command') en producción para evitar errores humanos." : "Block dangerous nodes (e.g., 'Execute Command') in production to prevent human errors.",
        
        statAnalysis: isEs ? "Análisis Estático" : "Static Analysis",
        statStudents: isEs ? "Estudiantes / Clase" : "Students / Class",
        statIncidents: isEs ? "Incidentes" : "Incidents",
    }

    return (
        <div className="min-h-screen bg-black text-white pt-24 pb-20 px-4 relative overflow-hidden">
             {/* Tech Background */}
             <div className="absolute inset-0 z-0">
                 <GridPattern
                    width={40}
                    height={40}
                    x={-1}
                    y={-1}
                    className="stroke-purple-500/10 [mask-image:radial-gradient(1200px_circle_at_center,white,transparent)]"
                />
            </div>
            
            {/* Hero Section */}
            <div className="max-w-7xl mx-auto text-center mb-24">
                <div className="inline-block p-2 bg-purple-500/10 rounded-lg mb-4 border border-purple-500/20">
                    <span className="text-purple-400 font-bold uppercase tracking-wider text-sm">{texts.badge}</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-500 mb-8">
                    {texts.heroTitleStart}<br />{texts.heroTitleEnd}
                </h1>
                <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
                    {texts.heroSubtitle}
                </p>
                <Link href={`/${lang}/pricing`}>
                    <Button size="lg" color="primary" className="font-bold shadow-lg shadow-purple-500/20">
                        {texts.cta}
                    </Button>
                </Link>
            </div>

            {/* Grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                <BenefitCard
                    icon={<Activity size={32} className="text-green-400" />}
                    title={texts.featDocTitle}
                    desc={texts.featDocDesc}
                    stat="100%"
                    statLabel={texts.statAnalysis}
                />
                <BenefitCard
                    icon={<GraduationCap size={32} className="text-blue-400" />}
                    title={texts.featEduTitle}
                    desc={texts.featEduDesc}
                    stat="30+"
                    statLabel={texts.statStudents}
                />
                <BenefitCard
                    icon={<ShieldAlert size={32} className="text-red-400" />}
                    title={texts.featGovTitle}
                    desc={texts.featGovDesc}
                    stat="0"
                    statLabel={texts.statIncidents}
                />
            </div>

            {/* Use Cases */}
            <div className="max-w-7xl mx-auto mb-20">
                <h2 className="text-4xl font-bold text-center mb-16">{isEs ? "¿Qué controlamos?" : "What do we govern?"}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <UseCase 
                        title="Secrets Scan" 
                        desc={isEs ? "Encuentra SK-keys mal puestas." : "Find misplaced SK-keys."} 
                        icon={<FileSearch />} 
                    />
                    <UseCase 
                        title="Role Access" 
                        desc={isEs ? "Solo Admins usan 'Production'." : "Only Admins use 'Production'."} 
                        icon={<LockKeyhole />} 
                    />
                    <UseCase 
                        title="Policy Engine" 
                        desc={isEs ? "Reglas JSON personalizadas." : "Custom JSON rules."} 
                        icon={<Gavel />} 
                    />
                    <UseCase 
                        title="Audit Logs" 
                        desc={isEs ? "Rastreo forense de ejecuciones." : "Forensic execution tracking."} 
                        icon={<Activity />} 
                    />
                    <UseCase 
                        title="Classroom" 
                        desc={isEs ? "Espacios de trabajo aislados." : "Isolated workspaces."} 
                        icon={<GraduationCap />} 
                    />
                    <UseCase 
                        title="SSO Gateway" 
                        desc={isEs ? "Login unificado (Google/MS)." : "Unified Login (Google/MS)."} 
                        icon={<LockKeyhole />} 
                    />
                </div>
            </div>
        </div>
    );
}

function BenefitCard({ icon, title, desc, stat, statLabel }: any) {
    return (
        <Card className="bg-white/5 border-white/5 p-6 hover:bg-white/10 transition-colors">
            <CardHeader className="flex justify-between items-start">
                <div className="p-3 bg-white/5 rounded-xl">{icon}</div>
                <div className="text-right">
                    <div className="text-3xl font-bold">{stat}</div>
                    <div className="text-xs text-gray-500 uppercase font-bold">{statLabel}</div>
                </div>
            </CardHeader>
            <CardBody className="pt-4">
                <h3 className="text-2xl font-bold mb-3">{title}</h3>
                <p className="text-gray-400 leading-relaxed">{desc}</p>
            </CardBody>
        </Card>
    )
}

function UseCase({ title, desc, icon }: any) {
    return (
        <div className="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors cursor-default border border-transparent hover:border-white/5">
            <div className="mt-1 text-gray-400">{icon}</div>
            <div>
                <h4 className="font-bold text-lg">{title}</h4>
                <p className="text-sm text-gray-500 mt-1">{desc}</p>
            </div>
        </div>
    )
}
