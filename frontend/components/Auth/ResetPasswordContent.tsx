'use client';

import { Card, CardBody, CardHeader, Button, Input } from "@heroui/react";
import Link from 'next/link';
import { Lock, ArrowRight, CheckCircle2, ArrowLeft, KeyRound, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/utils/api';

export default function ResetPasswordContent({ lang }: { lang: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (!tokenParam) {
            setError('Invalid reset link. Please request a new one.');
        } else {
            setToken(tokenParam);
        }
    }, [searchParams]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await apiFetch('/api/auth/reset-password', { 
                method: 'POST', 
                body: JSON.stringify({ token, newPassword: password }) 
            });
            setIsSuccess(true);
            setTimeout(() => {
                router.push(`/${lang}/login`);
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to reset password. The link may have expired.');
        } finally {
            setIsLoading(false);
        }
    };

    const isEs = lang === 'es';

    const text = {
        title: isEs ? "Nueva contraseña" : "Set New Password",
        subtitle: isEs 
            ? "Ingresa tu nueva contraseña" 
            : "Enter your new password below",
        password: isEs ? "Nueva contraseña" : "New Password",
        confirmPassword: isEs ? "Confirmar contraseña" : "Confirm Password",
        submit: isEs ? "Cambiar contraseña" : "Reset Password",
        back: isEs ? "Volver al inicio de sesión" : "Back to login",
        successTitle: isEs ? "¡Contraseña actualizada!" : "Password Reset!",
        successDesc: isEs 
            ? "Tu contraseña ha sido actualizada exitosamente. Serás redirigido al inicio de sesión." 
            : "Your password has been reset successfully. You will be redirected to login.",
        invalidLink: isEs ? "Enlace inválido" : "Invalid Link",
        invalidDesc: isEs 
            ? "Este enlace de recuperación no es válido o ha expirado." 
            : "This reset link is invalid or has expired.",
        requestNew: isEs ? "Solicitar nuevo enlace" : "Request new link"
    };

    if (isSuccess) {
        return (
            <div className="relative w-full max-w-md">
                <div className="absolute -inset-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-[2rem] blur-2xl opacity-20 pointer-events-none" />
                <Card className="w-full bg-[#09090b]/80 backdrop-blur-2xl border-white/10 relative z-10 shadow-2xl rounded-[2rem]">
                    <CardBody className="px-8 py-12 text-center">
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20 text-green-500 shadow-lg shadow-green-500/10">
                            <CheckCircle2 size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{text.successTitle}</h2>
                        <p className="text-gray-400 mb-8 leading-relaxed">{text.successDesc}</p>
                        <Link href={`/${lang}/login`}>
                            <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600">
                                {text.back}
                            </Button>
                        </Link>
                    </CardBody>
                </Card>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="relative w-full max-w-md">
                <div className="absolute -inset-4 bg-gradient-to-r from-red-500 to-orange-600 rounded-[2rem] blur-2xl opacity-20 pointer-events-none" />
                <Card className="w-full bg-[#09090b]/80 backdrop-blur-2xl border-white/10 relative z-10 shadow-2xl rounded-[2rem]">
                    <CardBody className="px-8 py-12 text-center">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20 text-red-500">
                            <KeyRound size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{text.invalidLink}</h2>
                        <p className="text-gray-400 mb-8 leading-relaxed">{text.invalidDesc}</p>
                        <Link href={`/${lang}/forgot-password`}>
                            <Button className="w-full bg-gradient-to-r from-purple-600 to-indigo-600">
                                {text.requestNew}
                            </Button>
                        </Link>
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <Link href={`/${lang}/login`} className="flex items-center justify-center gap-2 text-sm text-white hover:text-purple-400 transition-colors font-medium">
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
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] blur-2xl opacity-20 pointer-events-none" />
            
            <Card className="w-full bg-[#09090b]/80 backdrop-blur-2xl border-white/10 relative z-10 shadow-2xl rounded-[2rem]">
                <CardHeader className="flex flex-col gap-2 px-8 pt-8 pb-0">
                    <div className="flex items-center gap-3 mb-4 justify-center">
                        <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
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
                                type={showPassword ? "text" : "password"}
                                label={text.password}
                                placeholder="••••••••"
                                value={password}
                                onValueChange={setPassword}
                                variant="bordered"
                                startContent={<Lock size={18} className="text-gray-500" />}
                                endContent={
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-500 hover:text-white">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                }
                                classNames={{
                                    input: "text-white group-data-[has-value=true]:text-white",
                                    label: "text-gray-400 group-data-[filled-within=true]:text-purple-400",
                                    inputWrapper: "h-14 bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-purple-500/50 transition-colors rounded-xl"
                                }}
                                disabled={isLoading}
                                required
                            />
                            <Input
                                type={showPassword ? "text" : "password"}
                                label={text.confirmPassword}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onValueChange={setConfirmPassword}
                                variant="bordered"
                                startContent={<Lock size={18} className="text-gray-500" />}
                                classNames={{
                                    input: "text-white group-data-[has-value=true]:text-white",
                                    label: "text-gray-400 group-data-[filled-within=true]:text-purple-400",
                                    inputWrapper: "h-14 bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-purple-500/50 transition-colors rounded-xl"
                                }}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 font-bold text-md bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-purple-900/20 rounded-xl"
                            isLoading={isLoading}
                            endContent={!isLoading && <ArrowRight size={18} />}
                        >
                            {text.submit}
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
