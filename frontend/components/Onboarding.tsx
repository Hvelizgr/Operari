'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface OnboardingStep {
    title: string;
    description: string;
    position: { x: number; y: number };
    highlight?: 'node' | 'port-output' | 'port-input' | 'canvas';
}

interface OnboardingProps {
    currentStep: number;
    steps: OnboardingStep[];
    onNext: () => void;
    onSkip: () => void;
    onClose: () => void;
}

export default function Onboarding({
    currentStep,
    steps,
    onNext,
    onSkip,
    onClose,
}: OnboardingProps) {
    if (currentStep >= steps.length) return null;

    const step = steps[currentStep];

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />

                <motion.div
                    className="absolute pointer-events-auto"
                    style={{
                        left: step.position.x,
                        top: step.position.y,
                    }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                    <div className="bg-slate-800 border-2 border-blue-500 rounded-lg shadow-2xl shadow-blue-500/20 p-6 max-w-sm">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-100">{step.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {steps.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`h-1 rounded-full transition-all duration-300 ${idx === currentStep
                                                ? 'w-6 bg-blue-500'
                                                : idx < currentStep
                                                    ? 'w-2 bg-blue-400'
                                                    : 'w-2 bg-slate-600'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-sm text-slate-300 mb-4">{step.description}</p>

                        <div className="flex items-center justify-between gap-3">
                            <button
                                onClick={onSkip}
                                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                Skip Tour
                            </button>
                            <button
                                onClick={onNext}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                            </button>
                        </div>
                    </div>

                    <svg
                        className="absolute -bottom-3 left-8 text-blue-500"
                        width="24"
                        height="12"
                        viewBox="0 0 24 12"
                    >
                        <path
                            d="M12 12L0 0h24z"
                            fill="currentColor"
                        />
                    </svg>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

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
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors pointer-events-auto">
                    {text.cta}
                </button>
            </div>
        </motion.div>
    );
}

export const ONBOARDING_STEPS_EN: OnboardingStep[] = [
    {
        title: 'Welcome to the Editor',
        description: 'This is your visual workflow canvas. You can pan by dragging and zoom with your mouse wheel.',
        position: { x: 100, y: 100 },
        highlight: 'canvas' as const,
    },
    {
        title: 'Workflow Nodes',
        description: 'These are workflow nodes. Each node represents an action or trigger in your automation.',
        position: { x: 150, y: 200 },
        highlight: 'node' as const,
    },
    {
        title: 'Output Ports',
        description: 'Drag from the blue output port on the right to connect nodes together.',
        position: { x: 500, y: 180 },
        highlight: 'port-output' as const,
    },
    {
        title: 'Input Ports',
        description: 'Drop connections on the input port (left side) to link workflows.',
        position: { x: 450, y: 280 },
        highlight: 'port-input' as const,
    },
    {
        title: 'Ready to Build!',
        description: 'You can now drag nodes, create connections, and build powerful automations!',
        position: { x: 300, y: 150 },
    },
];

export const ONBOARDING_STEPS_ES: OnboardingStep[] = [
    {
        title: 'Bienvenido al Editor',
        description: 'Este es tu canvas de flujo visual. Puedes desplazarte arrastrando y hacer zoom con la rueda del mouse.',
        position: { x: 100, y: 100 },
        highlight: 'canvas' as const,
    },
    {
        title: 'Nodos de Flujo',
        description: 'Estos son nodos de flujo. Cada nodo representa una acción o disparador en tu automatización.',
        position: { x: 150, y: 200 },
        highlight: 'node' as const,
    },
    {
        title: 'Puertos de Salida',
        description: 'Arrastra desde el puerto azul de salida a la derecha para conectar nodos.',
        position: { x: 500, y: 180 },
        highlight: 'port-output' as const,
    },
    {
        title: 'Puertos de Entrada',
        description: 'Suelta las conexiones en el puerto de entrada (lado izquierdo) para vincular flujos.',
        position: { x: 450, y: 280 },
        highlight: 'port-input' as const,
    },
    {
        title: '¡Listo para Construir!',
        description: '¡Ahora puedes arrastrar nodos, crear conexiones y construir automatizaciones poderosas!',
        position: { x: 300, y: 150 },
    },
];
