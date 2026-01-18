'use client';

import { useParams } from 'next/navigation';

export default function TermsPage() {
    const params = useParams();
    const lang = params.lang || 'en';
    const isEs = lang === 'es';

    const text = {
        title: isEs ? "Términos de Servicio" : "Terms of Service",
        updated: isEs ? "Última actualización: 18 de Enero, 2026" : "Last updated: January 18, 2026",
        sections: [
            {
                title: isEs ? "1. Aceptación de Términos" : "1. Acceptance of Terms",
                content: isEs 
                    ? "Al acceder y usar NanoFlow, aceptas y acuerdas estar sujeto a los términos y condiciones de este acuerdo."
                    : "By accessing and using NanoFlow, you accept and agree to be bound by the terms and provision of this agreement."
            },
            {
                title: isEs ? "2. Licencia de Uso" : "2. Use License",
                content: isEs 
                    ? "Se otorga permiso para descargar temporalmente una copia de los materiales (información o software) en el sitio web de NanoFlow solo para visualización personal y no comercial."
                    : "Permission is granted to temporarily download one copy of the materials (information or software) on NanoFlow's website for personal, non-commercial transitory viewing only."
            },
            {
                title: isEs ? "3. Descargo de Responsabilidad" : "3. Disclaimer",
                content: isEs 
                    ? "Los materiales en el sitio web de NanoFlow se proporcionan 'tal cual'. NanoFlow no ofrece garantías, expresas o implícitas, y por la presente renuncia y niega todas las demás garantías incluyendo, sin limitación, garantías implícitas o condiciones de comerciabilidad, idoneidad para un propósito particular, o no infracción de propiedad intelectual u otra violación de derechos."
                    : "The materials on NanoFlow's website are provided 'as is'. NanoFlow makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights."
            },
            {
                title: isEs ? "4. Limitaciones" : "4. Limitations",
                content: isEs 
                    ? "En ningún caso NanoFlow o sus proveedores serán responsables de ningún daño (incluyendo, sin limitación, daños por pérdida de datos o ganancias, o debido a interrupción del negocio) que surja del uso o la imposibilidad de usar los materiales en el sitio web de NanoFlow."
                    : "In no event shall NanoFlow or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on NanoFlow's website."
            },
            {
                title: isEs ? "5. Revisiones y Erratas" : "5. Revisions and Errata",
                content: isEs 
                    ? "Los materiales que aparecen en el sitio web de NanoFlow podrían incluir errores técnicos, tipográficos o fotográficos. NanoFlow no garantiza que ninguno de los materiales en su sitio web sea preciso, completo o actual."
                    : "The materials appearing on NanoFlow's website could include technical, typographical, or photographic errors. NanoFlow does not warrant that any of the materials on its website are accurate, complete, or current."
            },
            {
                title: isEs ? "6. Ley Aplicable" : "6. Governing Law",
                content: isEs 
                    ? "Cualquier reclamación relacionada con el sitio web de NanoFlow se regirá por las leyes del Estado de Delaware sin tener en cuenta sus disposiciones sobre conflicto de leyes."
                    : "Any claim relating to NanoFlow's website shall be governed by the laws of the State of Delaware without regard to its conflict of law provisions."
            }
        ]
    };

    return (
        <div className="min-h-screen bg-black text-white pt-24 pb-20 px-4">
            <div className="max-w-3xl mx-auto prose prose-invert">
                <h1>{text.title}</h1>
                <p className="lead">{text.updated}</p>

                {text.sections.map((section, idx) => (
                    <div key={idx}>
                        <h2>{section.title}</h2>
                        <p>{section.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
