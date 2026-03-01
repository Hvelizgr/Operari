'use client';

import { Card, CardBody, CardHeader, Divider, Button, Input, Chip } from "@heroui/react";
import Link from 'next/link';
import { Lock, Mail, Github, Chrome, ArrowRight, Check, AlertCircle, Stethoscope, GraduationCap, Building2 } from "lucide-react";
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/utils/api';

const isDev = process.env.NODE_ENV === 'development';

const demoAccounts = [
    {
        id: 'student',
        name: 'Student / Free',
        nameEs: 'Estudiante / Free',
        email: 'student@nanoflow.dev',
        password: 'student123',
        icon: Stethoscope,
        color: 'text-green-500',
        bgColor: 'bg-green-500/20',
        desc: 'Basic diagnostics',
        descEs: 'Diagnóstico básico'
    },
    {
        id: 'pro',
        name: 'Education / Pro',
        nameEs: 'Educación / Pro',
        email: 'teacher@nanoflow.dev',
        password: 'teacher123',
        icon: GraduationCap,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/20',
        desc: 'Classroom mode',
        descEs: 'Modo aula'
    },
    {
        id: 'growth',
        name: 'SMEs / Growth',
        nameEs: 'PyMEs / Growth',
        email: 'agency@nanoflow.dev',
        password: 'agency123',
        icon: Building2,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/20',
        desc: 'Multi-client',
        descEs: 'Multi-cliente'
    }
];

export default function LoginContent({ lang }: { lang: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [resendSuccess, setResendSuccess] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    const planParam = searchParams.get('plan');

    const handleResendVerification = async () => {
        setIsResending(true);
        try {
            await apiFetch('/api/auth/resend-verification', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            setResendSuccess(true);
            setError(null);
            setErrorCode(null);
        } catch (err: any) {
            setError(err.message || 'Failed to resend verification email');
        } finally {
            setIsResending(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setErrorCode(null);
        setResendSuccess(false);

        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            localStorage.setItem('nanoflow_token', data.token);
            localStorage.setItem('nanoflow_user', JSON.stringify(data.user));
            localStorage.setItem('nanoflow_tenant', JSON.stringify(data.tenant));

            if (planParam) {
                localStorage.setItem('nanoflow_user_plan', planParam);
            }

            router.push(`/${lang}/dashboard`);
        } catch (err: any) {
            if (err.code === 'EMAIL_NOT_VERIFIED') {
                setErrorCode('EMAIL_NOT_VERIFIED');
                setError(err.message || 'Please verify your email before logging in.');
            } else {
                setError(err.message || 'Login failed');
            }
            setIsLoading(false);
        }
    };

    const isEs = lang === 'es';

    const text = {
        title: isEs ? "Bienvenido de vuelta" : "Welcome back",
        subtitle: isEs ? "Ingresa a tu cuenta de NanoFlow" : "Sign in to your NanoFlow account",
        email: isEs ? "Correo electrónico" : "Email",
        password: isEs ? "Contraseña" : "Password",
        remember: isEs ? "Recordarme" : "Remember me",
        forgot: isEs ? "¿Olvidaste tu contraseña?" : "Forgot password?",
        signin: isEs ? "Iniciar sesión" : "Sign in",
        or: isEs ? "o continúa con" : "or continue with",
        noAccount: isEs ? "¿No tienes cuenta?" : "Don't have an account?",
        signup: isEs ? "Regístrate" : "Sign up",
        demoTitle: isEs ? "Cuentas de Prueba" : "Test Accounts",
        demoSubtitle: isEs ? "(Solo en desarrollo)" : "(Dev only)"
    };

    return (
        <div className="relative w-full max-w-md">
            {/* Aura Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2rem] blur-2xl opacity-20 pointer-events-none" />
            
            <Card className="w-full bg-[#09090b]/80 backdrop-blur-2xl border-white/10 relative z-10 shadow-2xl rounded-[2rem]">
                <CardHeader className="flex flex-col gap-2 px-8 pt-8 pb-0">
                    <div className="flex items-center gap-3 mb-4 justify-center">
                        <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Lock className="text-white" size={24} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center tracking-tight">{text.title}</h2>
                    <p className="text-sm text-gray-400 text-center">{text.subtitle}</p>
                </CardHeader>

                <CardBody className="px-8 py-8">
                    <form onSubmit={handleLogin} className="flex flex-col gap-5">
                        {resendSuccess && (
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-200 text-sm flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Verification email sent! Please check your inbox.
                            </div>
                        )}

                        {error && errorCode === 'EMAIL_NOT_VERIFIED' && (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                <div className="flex items-center gap-3 text-yellow-200 text-sm mb-3">
                                    <AlertCircle size={18} />
                                    {error}
                                </div>
                                <Button
                                    size="sm"
                                    variant="bordered"
                                    className="w-full border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/10"
                                    isLoading={isResending}
                                    onPress={handleResendVerification}
                                >
                                    Resend Verification Email
                                </Button>
                            </div>
                        )}

                        {error && errorCode !== 'EMAIL_NOT_VERIFIED' && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm text-gray-400 font-medium">{text.email}</label>
                                <Input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onValueChange={setEmail}
                                    variant="bordered"
                                    startContent={<Mail size={18} className="text-gray-500" />}
                                    classNames={{
                                        input: "text-white group-data-[has-value=true]:text-white",
                                        inputWrapper: "h-12 bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-blue-500/50 transition-colors rounded-xl"
                                    }}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm text-gray-400 font-medium">{text.password}</label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onValueChange={setPassword}
                                    variant="bordered"
                                    startContent={<Lock size={18} className="text-gray-500" />}
                                    classNames={{
                                        input: "text-white group-data-[has-value=true]:text-white",
                                        inputWrapper: "h-12 bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-purple-500/50 transition-colors rounded-xl"
                                    }}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-gray-500 bg-transparent text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                />
                                <span className="text-gray-400 text-sm">{text.remember}</span>
                            </label>
                            <Link href={`/${lang}/forgot-password`} className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                                {text.forgot}
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 font-bold text-md bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-900/20 rounded-xl"
                            isLoading={isLoading}
                            endContent={!isLoading && <ArrowRight size={18} />}
                        >
                            {text.signin}
                        </Button>

                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#09090b] px-4 text-gray-500">{text.or}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button 
                                variant="bordered" 
                                className="h-12 border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl"
                                onPress={() => window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/auth/oauth/github`}
                            >
                                <Github size={20} />
                                <span className="sr-only">Github</span>
                            </Button>
                            <Button 
                                variant="bordered" 
                                className="h-12 border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl"
                                onPress={() => window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/auth/oauth/google`}
                            >
                                <Chrome size={20} />
                                <span className="sr-only">Google</span>
                            </Button>
                        </div>

                        {isDev && (
                            <div className="mt-2 p-4 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 border border-yellow-500/20 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-sm font-bold text-yellow-200">{text.demoTitle}</span>
                                    <Chip size="sm" variant="flat" className="bg-yellow-500/20 text-yellow-300 text-[10px]">
                                        {text.demoSubtitle}
                                    </Chip>
                                </div>
                                <div className="space-y-2">
                                    {demoAccounts.map((account) => {
                                        const Icon = account.icon;
                                        return (
                                            <div 
                                                key={account.id}
                                                className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all group"
                                                onClick={() => {
                                                    setEmail(account.email);
                                                    setPassword(account.password);
                                                }}
                                            >
                                                <div className={`p-1.5 rounded-lg ${account.bgColor} ${account.color}`}>
                                                    <Icon size={14} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-semibold text-gray-200 group-hover:text-white truncate">
                                                        {isEs ? account.nameEs : account.name}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 truncate">
                                                        {account.email}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-gray-600 group-hover:text-gray-400">
                                                    Click
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <p className="text-center text-sm text-gray-500 mt-4">
                            {text.noAccount}{' '}
                            <Link href={`/${lang}/pricing`} className="text-white hover:text-blue-400 font-semibold transition-colors">
                                {text.signup}
                            </Link>
                        </p>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}
