
'use client';

import { Card, CardBody, CardHeader, Button, Chip, Divider } from "@heroui/react";
import { GraduationCap, Shield, Terminal, CheckCircle2, ArrowRight, Building2, Zap, Laptop, BookOpen, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { use } from 'react';

export default function SolutionsPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = use(params);

    const isEs = lang === 'es';

    const text = {
        title: isEs ? "Soluciones para Cada Escenario" : "Solutions for Every Scenario",
        subtitle: isEs ? "Ya seas una universidad, una agencia o un equipo DevOps, NanoFlow se adapta a ti." : "Whether you're a university, an agency, or a DevOps team, NanoFlow adapts to you.",
        schools: {
            title: isEs ? "Para Instituciones Educativas" : "For Educational Institutions",
            desc: isEs ? "Transforma tu aula en un laboratorio de automatización práctico y seguro." : "Transform your classroom into a practical and secure automation lab.",
            features: [
                isEs ? "Aislamiento de Entornos por Estudiante" : "Student Environment Isolation",
                isEs ? "Auto-calificación de Tareas" : "Assignment Auto-grading",
                isEs ? "Librería de Plantillas Educativas" : "Educational Template Library",
                isEs ? "Sin riesgo de romper producción" : "No risk of breaking production"
            ],
            cta: isEs ? "Ver Plan Educativo" : "View Education Plan"
        },
        enterprise: {
            title: isEs ? "Para Gobierno y Empresas" : "For Government & Enterprise",
            desc: isEs ? "Gobernanza estricta, auditoría y cumplimiento normativo para automatización crítica." : "Strict governance, auditing, and compliance for critical automation.",
            features: [
                isEs ? "Policy-as-Code (OPA)" : "Policy-as-Code (OPA)",
                isEs ? "Logs de Auditoría Inmutables" : "Immutable Audit Logs",
                isEs ? "Integración SSO (SAML/OIDC)" : "SSO Integration (SAML/OIDC)",
                isEs ? "SLA de 99.99% Garantizado" : "99.99% SLA Guaranteed"
            ],
            cta: isEs ? "Contactar Ventas" : "Contact Sales"
        },
        devs: {
            title: isEs ? "Para Desarrolladores y Agencias" : "For Developers & Agencies",
            desc: isEs ? "Herramientas avanzadas para construir, depurar y entregar flujos complejos más rápido." : "Advanced tools to build, debug, and deliver complex workflows faster.",
            features: [
                isEs ? "Diagnóstico de Flujos con IA" : "AI Workflow Diagnostics",
                isEs ? "Gestión Multi-Cliente" : "Multi-Client Management",
                isEs ? "Editor JSON Avanzado" : "Advanced JSON Editor",
                isEs ? "Webhooks Escalables" : "Scalable Webhooks"
            ],
            cta: isEs ? "Empezar Gratis" : "Start Free"
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1
        }
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
            {/* Header */}
            <div className="pt-32 pb-20 px-4 max-w-7xl mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <Chip variant="flat" color="primary" className="mb-4">{isEs ? 'Casos de Uso' : 'Use Cases'}</Chip>
                    <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-indigo-600 mb-6 pb-2">
                        {text.title}
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        {text.subtitle}
                    </p>
                </motion.div>
            </div>

            {/* Sections */}
            <motion.div 
                className="max-w-7xl mx-auto px-4 pb-32 space-y-32"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* SCHOOLS */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="order-2 lg:order-1 relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
                        <Card className="bg-[#09090b] border-white/10 p-10 relative rounded-[2.5rem] overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-20">
                                <GraduationCap size={120} className="text-blue-500" />
                            </div>
                            
                            <CardHeader className="p-0 mb-8 relative z-10">
                                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/10 mb-6">
                                    <GraduationCap size={32} />
                                </div>
                                <h3 className="text-3xl font-bold text-white">
                                    {text.schools.title}
                                </h3>
                            </CardHeader>
                            <CardBody className="p-0 space-y-8 relative z-10">
                                <p className="text-gray-400 text-lg leading-relaxed font-light">
                                    {text.schools.desc}
                                </p>
                                <ul className="space-y-4">
                                    {text.schools.features.map((feat, i) => (
                                        <li key={i} className="flex items-center gap-4 group/item">
                                            <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover/item:bg-blue-500 group-hover/item:text-white transition-colors">
                                                <CheckCircle2 size={14} />
                                            </div>
                                            <span className="text-gray-300 font-light">{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button 
                                    className="w-full bg-blue-600 text-white font-bold h-14 rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-500"
                                    endContent={<ArrowRight size={20} />}
                                >
                                    {text.schools.cta}
                                </Button>
                            </CardBody>
                        </Card>
                    </div>
                    <div className="order-1 lg:order-2 space-y-8 lg:pl-12">
                         <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/20 border border-blue-500/30 text-blue-400 font-mono text-sm uppercase tracking-widest">
                            <BookOpen size={14} /> {isEs ? 'Educación' : 'Education'}
                         </div>
                         <h2 className="text-5xl font-bold leading-tight">{isEs ? 'Formando la Próxima Generación' : 'Training the Next Generation'}</h2>
                         <p className="text-gray-400 leading-relaxed text-xl font-light">
                            {isEs 
                              ? 'Los profesores necesitan calificar miles de flujos sin revisión manual. Los estudiantes necesitan un sandbox que se sienta real pero proteja la infraestructura. NanoFlow cierra esta brecha con el ' 
                              : 'Professors need a way to grade thousands of student workflows without manual review. Students need a sandbox that feels real but protects infrastructure. NanoFlow bridges this gap with '}
                            <span className="text-blue-400 font-semibold">{isEs ? 'Modo Aula' : 'Classroom Mode'}</span>.
                         </p>
                    </div>
                </motion.div>

                {/* ENTERPRISE */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8 lg:pr-12">
                         <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-900/20 border border-purple-500/30 text-purple-400 font-mono text-sm uppercase tracking-widest">
                            <Building2 size={14} /> {isEs ? 'Empresas' : 'Enterprise'}
                         </div>
                         <h2 className="text-5xl font-bold leading-tight">{isEs ? 'Gobernanza Sin Compromisos' : 'Uncompromising Governance'}</h2>
                         <p className="text-gray-400 leading-relaxed text-xl font-light">
                            {isEs 
                              ? 'El Shadow IT es un riesgo. NanoFlow lleva la ' 
                              : 'Shadow IT is a risk. NanoFlow brings '}
                            <span className="text-purple-400 font-semibold">{isEs ? 'disciplina DevOps' : 'DevOps discipline'}</span>
                            {isEs 
                              ? ' al low-code. Controla exactamente qué nodos pueden usarse, quién puede desplegar a producción y audita cada paso de ejecución.' 
                              : ' to low-code. Control exactly which nodes can be used, who can deploy to production, and audit every single execution step.'}
                         </p>
                    </div>
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
                        <Card className="bg-[#09090b] border-white/10 p-10 relative rounded-[2.5rem] overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-20">
                                <Shield size={120} className="text-purple-500" />
                            </div>
                            
                            <CardHeader className="p-0 mb-8 relative z-10">
                                <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/20 shadow-lg shadow-purple-500/10 mb-6">
                                    <Shield size={32} />
                                </div>
                                <h3 className="text-3xl font-bold text-white">
                                    {text.enterprise.title}
                                </h3>
                            </CardHeader>
                            <CardBody className="p-0 space-y-8 relative z-10">
                                <p className="text-gray-400 text-lg leading-relaxed font-light">
                                    {text.enterprise.desc}
                                </p>
                                <ul className="space-y-4">
                                    {text.enterprise.features.map((feat, i) => (
                                        <li key={i} className="flex items-center gap-4 group/item">
                                            <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover/item:bg-purple-500 group-hover/item:text-white transition-colors">
                                                <Lock size={14} />
                                            </div>
                                            <span className="text-gray-300 font-light">{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button 
                                    className="w-full bg-purple-600 text-white font-bold h-14 rounded-xl shadow-lg shadow-purple-900/20 hover:bg-purple-500"
                                    endContent={<ArrowRight size={20} />}
                                >
                                    {text.enterprise.cta}
                                </Button>
                            </CardBody>
                        </Card>
                    </div>
                </motion.div>

                {/* DEVS */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                     <div className="order-2 lg:order-1 relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-yellow-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
                        <Card className="bg-[#09090b] border-white/10 p-10 relative rounded-[2.5rem] overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-20">
                                <Terminal size={120} className="text-orange-500" />
                            </div>
                            
                            <CardHeader className="p-0 mb-8 relative z-10">
                                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-400 border border-orange-500/20 shadow-lg shadow-orange-500/10 mb-6">
                                    <Terminal size={32} />
                                </div>
                                <h3 className="text-3xl font-bold text-white">
                                    {text.devs.title}
                                </h3>
                            </CardHeader>
                            <CardBody className="p-0 space-y-8 relative z-10">
                                <p className="text-gray-400 text-lg leading-relaxed font-light">
                                    {text.devs.desc}
                                </p>
                                <ul className="space-y-4">
                                    {text.devs.features.map((feat, i) => (
                                        <li key={i} className="flex items-center gap-4 group/item">
                                            <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover/item:bg-orange-500 group-hover/item:text-white transition-colors">
                                                <Zap size={14} />
                                            </div>
                                            <span className="text-gray-300 font-light">{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Button 
                                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold h-14 rounded-xl shadow-lg shadow-orange-900/20 hover:opacity-90 border-none"
                                    endContent={<ArrowRight size={20} />}
                                >
                                    {text.devs.cta}
                                </Button>
                            </CardBody>
                        </Card>
                    </div>
                    <div className="order-1 lg:order-2 space-y-8 lg:pl-12">
                         <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-900/20 border border-orange-500/30 text-orange-400 font-mono text-sm uppercase tracking-widest">
                            <Laptop size={14} /> {isEs ? 'Desarrolladores' : 'Developers'}
                         </div>
                         <h2 className="text-5xl font-bold leading-tight mb-6">{isEs ? 'Hecho para Constructores' : 'Built for Builders'}</h2>
                         <p className="text-gray-400 leading-relaxed text-xl font-light">
                            {isEs 
                              ? 'Deja de hacer clic y empieza a programar. NanoFlow respeta tu experiencia. Usa nuestras herramientas de ' 
                              : 'Stop clicking and start coding. NanoFlow respects your expertise. Use our '}
                            <span className="text-orange-400 font-semibold">{isEs ? 'Análisis Estático' : 'Static Analysis'}</span>
                            {isEs 
                              ? ' para encontrar errores antes de que lleguen a producción y gestiona múltiples instancias de clientes desde un solo dashboard.' 
                              : ' tools to find bugs before they hit production and manage multiple client instances from a single dashboard.'}
                         </p>
                    </div>
                </motion.div>

            </motion.div>
        </div>
    );
}
