'use client';

import { Card, CardBody, CardHeader, Button, Input } from "@heroui/react";
import Link from 'next/link';
import { Mail, ArrowRight, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";
import { useState } from 'react';
import { apiFetch } from '@/utils/api';

export default function ForgotPasswordContent({ lang }: { lang: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
            setIsSent(true);
        } catch (err: any) {
            setError(err.message || 'Failed to send reset link');
        } finally {
            setIsLoading(false);
        }
    };

    const isEs = lang === 'es';

    const text = {
        title: isEs ? "Restablecer contraseña" : "Reset Password",
        subtitle: isEs 
            ? "Ingresa tu correo y te enviaremos las instrucciones." 
            : "Enter your email and we'll send you instructions.",
        email: isEs ? "Correo electrónico" : "Email",
        send: isEs ? "Enviar enlace" : "Send Reset Link",
        back: isEs ? "Volver al inicio de sesión" : "Back to login",
        successTitle: isEs ? "¡Correo enviado!" : "Check your email",
        successDesc: isEs 
            ? `Hemos enviado un enlace de recuperación a ${email}` 
            : `We have sent a password recovery link to ${email}`,
        tryAgain: isEs ? "Intentar con otro correo" : "Try another email"
    };

    if (isSent) {
        return (
            <div className="relative w-full max-w-md">
                 <div className="absolute -inset-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-[2rem] blur-2xl opacity-20 pointer-events-none" />
                 <Card className="w-full bg-[#09090b]/80 backdrop-blur-2xl border-white/10 relative z-10 shadow-2xl rounded-[2rem]">
                    <CardBody className="px-8 py-12 text-center">
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20 text-green-500 shadow-lg shadow-green-500/10">
                            <CheckCircle2 size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{text.successTitle}</h2>
                        <p className="text-gray-400 mb-8 leading-relaxed">
                            {text.successDesc}
                        </p>
                        <Button 
                            variant="ghost" 
                            className="w-full text-gray-400 hover:text-white"
                            onPress={() => setIsSent(false)}
                        >
                            {text.tryAgain}
                        </Button>
                        <div className="mt-4 pt-4 border-t border-white/10">
                             <Link href={`/${lang}/login`} className="flex items-center justify-center gap-2 text-sm text-white hover:text-green-400 transition-colors font-medium">
                                <ArrowLeft size={16} />
                                {text.back}
                            </Link>
                        </div>
                    </CardBody>
                 </Card>
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-md">
            {/* Aura Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-[2rem] blur-2xl opacity-20 pointer-events-none" />
            
            <Card className="w-full bg-[#09090b]/80 backdrop-blur-2xl border-white/10 relative z-10 shadow-2xl rounded-[2rem]">
                <CardHeader className="flex flex-col gap-2 px-8 pt-8 pb-0">
                    <div className="flex items-center gap-3 mb-4 justify-center">
                        <div className="w-12 h-12 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <KeyRound className="text-white" size={24} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center tracking-tight">{text.title}</h2>
                    <p className="text-sm text-gray-400 text-center max-w-xs mx-auto">{text.subtitle}</p>
                </CardHeader>

                <CardBody className="px-8 py-8">
                    <form onSubmit={handleReset} className="flex flex-col gap-6">
                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <Input
                                type="email"
                                label={text.email}
                                placeholder="name@example.com"
                                value={email}
                                onValueChange={setEmail}
                                variant="bordered"
                                startContent={<Mail size={18} className="text-gray-500" />}
                                classNames={{
                                    input: "text-white group-data-[has-value=true]:text-white",
                                    label: "text-gray-400 group-data-[filled-within=true]:text-cyan-400",
                                    inputWrapper: "h-14 bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-cyan-500/50 transition-colors rounded-xl"
                                }}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 font-bold text-md bg-gradient-to-r from-cyan-600 to-blue-600 shadow-lg shadow-cyan-900/20 rounded-xl"
                            isLoading={isLoading}
                            endContent={!isLoading && <ArrowRight size={18} />}
                        >
                            {text.send}
                        </Button>

                        <div className="relative my-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                        </div>

                        <Link href={`/${lang}/login`} className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft size={16} />
                            {text.back}
                        </Link>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}
