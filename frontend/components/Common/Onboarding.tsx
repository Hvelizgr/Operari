'use client';

import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { motion } from 'framer-motion';

interface OnboardingProps {
    steps: any[]; 
    onClose: () => void;
}

export default function Onboarding({
    steps,
    onClose,
}: OnboardingProps) {
    const driverObj = useRef<any>(null);

    useEffect(() => {
        if (!steps || steps.length === 0) return;

        driverObj.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            onDestroyStarted: () => {
                if (onClose) onClose();
                driverObj.current?.destroy();
            },
            steps: steps
        });

        driverObj.current.drive();

        return () => {
            if(driverObj.current) {
                driverObj.current.destroy();
            }
        };
    }, [steps, onClose]);

    return null;
}

export const ONBOARDING_STEPS_EN = [
    {
        element: '#workflow-canvas',
        popover: {
            title: 'Welcome to NanoFlow',
            description: 'This is your infinite visual canvas. Drag to pan, scroll to zoom.',
            side: "center",
            align: 'center'
        }
    },
    {
        element: '#tools-menu-btn',
        popover: {
            title: 'Tools & Nodes',
            description: 'Click here (or press Space) to add nodes, auto-layout, and use analysis tools.',
            side: "bottom",
            align: 'start'
        }
    },
    {
        element: '#run-workflow-btn',
        popover: {
            title: 'Execute Workflow',
            description: 'Run your workflow manually in debug mode (Ctrl+Enter).',
            side: "bottom",
            align: 'end'
        }
    },
    {
        element: '#terminal-toggle',
        popover: {
            title: 'Execution Logs',
            description: 'View live execution logs, output data, and history here.',
            side: "left",
            align: 'end'
        }
    }
];

export const ONBOARDING_STEPS_ES = [
    {
        element: '#workflow-canvas',
        popover: {
            title: 'Bienvenido a NanoFlow',
            description: 'Este es tu lienzo visual infinito. Arrastra para moverte, usa el scroll para zoom.',
            side: "center",
            align: 'center'
        }
    },
    {
        element: '#tools-menu-btn',
        popover: {
            title: 'Herramientas y Nodos',
            description: 'Haz clic aquí (o presiona Espacio) para agregar nodos, organizar y usar herramientas de análisis.',
            side: "bottom",
            align: 'start'
        }
    },
    {
        element: '#run-workflow-btn',
        popover: {
            title: 'Ejecutar Flujo',
            description: 'Ejecuta tu flujo manualmente en modo debug (Ctrl+Enter).',
            side: "bottom",
            align: 'end'
        }
    },
    {
        element: '#terminal-toggle',
        popover: {
            title: 'Registros de Ejecución',
            description: 'Visualiza registros en vivo, datos de salida e historial aquí.',
            side: "left",
            align: 'end'
        }
    }
];

export function EmptyStateMessage({ lang }: { lang: 'en' | 'es' }) {
    const content = {
        en: {
            title: 'Welcome to NanoFlow Editor',
            description: 'Start building your workflow by adding nodes and connecting them.',
            cta: 'Add Your First Node',
        },
        es: {
            title: 'Bienvenido al Editor NanoFlow',
            description: 'Comienza a construir tu flujo agregando nodos y conectándolos.',
            cta: 'Agregar Tu Primer Nodo',
        },
    };

    const text = content[lang] || content['en'];

    return (
        <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
        >
            <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-8 max-w-md">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-100 mb-2">{text.title}</h2>
                <p className="text-slate-400 mb-6">{text.description}</p>
                 <div className="px-6 py-3 bg-blue-600/50 text-white rounded-lg font-medium">
                    {lang === 'en' ? 'Press SPACE to add nodes' : 'Presiona ESPACIO para agregar nodos'}
                </div>
            </div>
        </motion.div>
    );
}
