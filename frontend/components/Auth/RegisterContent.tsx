'use client';

import { Card, CardBody, CardHeader, Divider, Button, Input, Checkbox } from "@heroui/react";
import Link from 'next/link';
import { Lock, Mail, User, Building2, ArrowRight } from "lucide-react";
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/utils/api';

export default function RegisterContent({ lang }: { lang: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState('');
    const [tenantName, setTenantName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    const planParam = searchParams.get('plan');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const data = await apiFetch('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ 
                    name,
                    tenantName,
                    email, 
                    password 
                }),
            });

            // Save auth data
            localStorage.setItem('nanoflow_token', data.token);
            localStorage.setItem('nanoflow_user', JSON.stringify(data.user));
            localStorage.setItem('nanoflow_tenant', JSON.stringify(data.tenant));

            if (planParam) {
                localStorage.setItem('nanoflow_user_plan', planParam);
            }

            // Redirect to dashboard or onboarding
            router.push(`/${lang}/dashboard`);
        } catch (err: any) {
            setError(err.message || 'Registration failed');
            setIsLoading(false);
        }
    };

    const isEs = lang === 'es';

    const text = {
        title: isEs ? "Crea tu cuenta" : "Create your account",
        subtitle: isEs ? "Comienza con NanoFlow hoy mismo" : "Get started with NanoFlow today",
        name: isEs ? "Nombre completo" : "Full Name",
        tenant: isEs ? "Nombre del Espacio de Trabajo" : "Workspace Name",
        email: isEs ? "Correo electrónico" : "Email",
        password: isEs ? "Contraseña" : "Password",
        create: isEs ? "Crear cuenta" : "Create account",
        existing: isEs ? "¿Ya tienes cuenta?" : "Already have an account?",
        signin: isEs ? "Inicia sesión" : "Sign in",
        terms: isEs ? "Al registrarte aceptas nuestros" : "By signing up you agree to our",
        termsLink: isEs ? "Términos y Condiciones" : "Terms & Conditions"
    };

    return (
        <div className="relative w-full max-w-md">
            {/* Aura Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-[2rem] blur-2xl opacity-20 pointer-events-none" />
            
            <Card className="w-full bg-[#09090b]/80 backdrop-blur-2xl border-white/10 relative z-10 shadow-2xl rounded-[2rem]">
                <CardHeader className="flex flex-col gap-2 px-8 pt-8 pb-0">
                    <div className="flex items-center gap-3 mb-4 justify-center">
                        <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <User className="text-white" size={24} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center tracking-tight">{text.title}</h2>
                    <p className="text-sm text-gray-400 text-center">{text.subtitle}</p>
                </CardHeader>

                <CardBody className="px-8 py-8">
                    <form onSubmit={handleRegister} className="flex flex-col gap-5">
                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <Input
                                type="text"
                                label={text.name}
                                placeholder="John Doe"
                                value={name}
                                onValueChange={setName}
                                variant="bordered"
                                startContent={<User size={18} className="text-gray-500" />}
                                classNames={{
                                    input: "text-white group-data-[has-value=true]:text-white",
                                    label: "text-gray-400 group-data-[filled-within=true]:text-purple-400",
                                    inputWrapper: "h-14 bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-purple-500/50 transition-colors rounded-xl"
                                }}
                                disabled={isLoading}
                                required
                            />
                            <Input
                                type="text"
                                label={text.tenant}
                                placeholder="Acme Inc."
                                value={tenantName}
                                onValueChange={setTenantName}
                                variant="bordered"
                                startContent={<Building2 size={18} className="text-gray-500" />}
                                classNames={{
                                    input: "text-white group-data-[has-value=true]:text-white",
                                    label: "text-gray-400 group-data-[filled-within=true]:text-pink-400",
                                    inputWrapper: "h-14 bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-pink-500/50 transition-colors rounded-xl"
                                }}
                                disabled={isLoading}
                                required
                            />
                            <Input
                                type="email"
                                label={text.email}
                                placeholder="john@acme.com"
                                value={email}
                                onValueChange={setEmail}
                                variant="bordered"
                                startContent={<Mail size={18} className="text-gray-500" />}
                                classNames={{
                                    input: "text-white group-data-[has-value=true]:text-white",
                                    label: "text-gray-400 group-data-[filled-within=true]:text-purple-400",
                                    inputWrapper: "h-14 bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-purple-500/50 transition-colors rounded-xl"
                                }}
                                disabled={isLoading}
                                required
                            />
                            <Input
                                type="password"
                                label={text.password}
                                placeholder="********"
                                value={password}
                                onValueChange={setPassword}
                                variant="bordered"
                                startContent={<Lock size={18} className="text-gray-500" />}
                                classNames={{
                                    input: "text-white group-data-[has-value=true]:text-white",
                                    label: "text-gray-400 group-data-[filled-within=true]:text-pink-400",
                                    inputWrapper: "h-14 bg-white/5 border-white/10 hover:border-white/20 group-data-[focus=true]:border-pink-500/50 transition-colors rounded-xl"
                                }}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 font-bold text-md bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-900/20 rounded-xl"
                            isLoading={isLoading}
                            endContent={!isLoading && <ArrowRight size={18} />}
                        >
                            {text.create}
                        </Button>

                        <p className="text-center text-xs text-gray-500 mt-2">
                            {text.terms}{' '}
                            <Link href="#" className="text-gray-400 hover:text-white underline decoration-gray-600 hover:decoration-white transition-all">
                                {text.termsLink}
                            </Link>
                        </p>

                        <div className="relative my-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                        </div>

                        <p className="text-center text-sm text-gray-500">
                            {text.existing}{' '}
                            <Link href={`/${lang}/login`} className="text-white hover:text-purple-400 font-semibold transition-colors">
                                {text.signin}
                            </Link>
                        </p>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}
