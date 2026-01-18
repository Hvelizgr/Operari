'use client';

import { Card, CardBody, Button, Accordion, AccordionItem } from "@heroui/react";
import { Shield, Lock, Fingerprint, Eye, Server, RefreshCw } from "lucide-react";
import { GridPattern } from "@/components/ui/GridPattern";
import { useParams } from 'next/navigation';

export default function SecurityPage() {
    const params = useParams();
    const lang = params.lang || 'en';
    const isEs = lang === 'es';

    const text = {
        title: isEs ? "Arquitectura de Seguridad" : "Security First Architecture",
        subtitle: isEs 
            ? "Tratamos tus datos con el más alto nivel de seguridad. Desde cifrado en reposo hasta controles de acceso estrictos, NanoFlow está construido para la confianza."
            : "We treat your data with the highest level of security. From encryption at rest to strict access controls, NanoFlow is built for trust.",
        features: [
            {
                title: isEs ? "Cifrado AES-256" : "AES-256 Encryption",
                desc: isEs 
                    ? "Todas las credenciales, API keys y datos sensibles de workflows se cifran en reposo usando AES-256 GCM estándar de la industria."
                    : "All credentials, API keys, and sensitive workflow data are encrypted at rest using industry-standard AES-256 GCM encryption.",
                icon: <Lock className="text-blue-400" />
            },
            {
                title: isEs ? "Control de Acceso (RBAC)" : "Role-Based Access Control (RBAC)",
                desc: isEs 
                    ? "Permisos granulares aseguran que el personal autorizado solo acceda a lo que necesita. Define roles personalizados para control detallado."
                    : "Granular permissions ensure authorized personnel only access what they need. Define custom roles for granular control.",
                icon: <Fingerprint className="text-purple-400" />
            },
            {
                title: isEs ? "Entornos de Ejecución Aislados" : "Isolated Execution Environments",
                desc: isEs 
                    ? "Cada workflow se ejecuta en entornos aislados (sandbox) para prevenir contaminación cruzada y asegurar estabilidad."
                    : "Each workflow runs in sandboxed environments to prevent cross-contamination and ensure stability.",
                icon: <Server className="text-orange-400" />
            },
            {
                title: isEs ? "Logs de Auditoría Completos" : "Comprehensive Audit Logs",
                desc: isEs 
                    ? "Rastrea cada acción dentro de la plataforma. Sabe exactamente quién modificó un workflow o accedió a una credencial y cuándo."
                    : "Track every action within the platform. Know exactly who modified a workflow or accessed a credential and when.",
                icon: <Eye className="text-green-400" />
            }
        ],
        faqTitle: isEs ? "Preguntas Frecuentes" : "Frequently Asked Questions",
        faq: [
            {
                title: isEs ? "¿Cumple NanoFlow con GDPR?" : "Is NanoFlow GDPR compliant?",
                answer: isEs 
                    ? "Sí, cumplimos totalmente con las regulaciones GDPR. Proporcionamos herramientas para exportación de datos y cumplimiento de solicitudes de eliminación."
                    : "Yes, we fully comply with GDPR regulations. We provide tools for data export and deletion request fulfillment."
            },
            {
                title: isEs ? "¿Dónde se alojan mis datos?" : "Where is my data hosted?",
                answer: isEs 
                    ? "Nuestra oferta cloud está alojada en AWS en US-East-1. Para clientes Enterprise, ofrecemos opciones de residencia de datos en EU y APAC, o despliegue On-Premise."
                    : "Our cloud offering is hosted on AWS in US-East-1. For Enterprise customers, we offer data residency options in EU and APAC, or On-Premise deployment."
            },
            {
                title: isEs ? "¿Realizan pruebas de penetración?" : "Do you perform penetration testing?",
                answer: isEs 
                    ? "Sí, nos asociamos con firmas de seguridad externas para realizar pruebas de penetración anuales. Los informes están disponibles para clientes Enterprise."
                    : "Yes, we partner with third-party security firms to conduct annual penetration tests. Reports are available for Enterprise customers."
            }
        ]
    };

    return (
        <div className="min-h-screen bg-black text-white pt-32 pb-20 px-4 relative overflow-hidden">
             <div className="absolute inset-0 pointer-events-none z-0">
                 <GridPattern
                    width={50}
                    height={50}
                    x={-1}
                    y={-1}
                    className="stroke-green-500/10 [mask-image:radial-gradient(800px_circle_at_center,white,transparent)]"
                />
            </div>
            <div className="relative z-10">
            <div className="max-w-4xl mx-auto text-center mb-20">
                <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-green-500">
                    <Shield size={32} />
                </div>
                <h1 className="text-5xl font-bold mb-6">{text.title}</h1>
                <p className="text-xl text-gray-400">{text.subtitle}</p>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
                {text.features.map((feature, idx) => (
                    <div key={idx} className="flex gap-4">
                        <div className="p-3 bg-white/5 rounded-xl h-fit">{feature.icon}</div>
                        <div>
                            <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-8">{text.faqTitle}</h2>
                <Accordion selectionMode="multiple" variant="splitted">
                    {text.faq.map((item, idx) => (
                        <AccordionItem key={idx} aria-label={item.title} title={item.title}>
                            {item.answer}
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
            </div>
        </div>
    );
}
