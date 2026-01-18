'use client';

import { Card, CardBody, CardHeader, Divider, Button, Input, Checkbox } from "@heroui/react";
import Link from 'next/link';
import { Lock, Mail, Github, Chrome, ArrowRight, Check } from "lucide-react";
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/utils/api';

export default function LoginContent({ lang }: { lang: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    const planParam = searchParams.get('plan');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            // Save auth data
            localStorage.setItem('nanoflow_token', data.token);
            localStorage.setItem('nanoflow_user', JSON.stringify(data.user));
            localStorage.setItem('nanoflow_tenant', JSON.stringify(data.tenant));

            if (planParam) {
                localStorage.setItem('nanoflow_user_plan', planParam);
            }

            router.push(`/${lang}/dashboard`);
        } catch (err: any) {
            setError(err.message || 'Login failed');
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
        demo: isEs ? "Cuenta Demo" : "Demo Account",
        demoEmail: "demo@nanoflow.dev",
        demoPassword: "demo123"
    };

    return (
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20 relative z-10">
            <CardHeader className="flex flex-col gap-2 px-8 pt-8 pb-0">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                        <Lock className="text-white" size={20} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">NanoFlow</h1>
                </div>
                <h2 className="text-xl font-semibold text-white">{text.title}</h2>
                <p className="text-sm text-gray-400">{text.subtitle}</p>
            </CardHeader>

            <CardBody className="px-8 py-6">
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    {error && (
                        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    <Input
                        type="email"
                        label={text.email}
                        placeholder={text.demoEmail}
                        value={email}
                        onValueChange={setEmail}
                        variant="bordered"
                        startContent={<Mail size={18} className="text-gray-400" />}
                        classNames={{
                            input: "text-white",
                            label: "text-gray-300",
                            inputWrapper: "border-white/20 bg-white/5"
                        }}
                        disabled={isLoading}
                        required
                    />
                    <Input
                        type="password"
                        label={text.password}
                        placeholder={text.demoPassword}
                        value={password}
                        onValueChange={setPassword}
                        variant="bordered"
                        startContent={<Lock size={18} className="text-gray-400" />}
                        classNames={{
                            input: "text-white",
                            label: "text-gray-300",
                            inputWrapper: "border-white/20 bg-white/5"
                        }}
                        disabled={isLoading}
                        required
                    />

                    <div className="flex items-center justify-between">
                        <Checkbox size="sm" classNames={{ label: "text-gray-300 text-sm" }}>
                            {text.remember}
                        </Checkbox>
                        <Link href="#" className="text-sm text-blue-400 hover:text-blue-300">
                            {text.forgot}
                        </Link>
                    </div>

                    <Button
                        type="submit"
                        color="primary"
                        size="lg"
                        className="w-full font-bold"
                        isLoading={isLoading}
                        endContent={!isLoading && <ArrowRight size={18} />}
                    >
                        {text.signin}
                    </Button>

                    <Divider className="my-2" />

                    <p className="text-center text-sm text-gray-400">{text.or}</p>

                    <div className="flex gap-3">
                        <Button variant="bordered" className="flex-1 border-white/20 bg-white/5 text-white">
                            <Github size={18} />
                        </Button>
                        <Button variant="bordered" className="flex-1 border-white/20 bg-white/5 text-white">
                            <Chrome size={18} />
                        </Button>
                    </div>

                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-xs text-blue-300 mb-2 flex items-center gap-2">
                            <Check size={14} /> {text.demo}
                        </p>
                        <p className="text-xs text-gray-400">
                            <strong>Email:</strong> {text.demoEmail}
                        </p>
                        <p className="text-xs text-gray-400">
                            <strong>Password:</strong> {text.demoPassword}
                        </p>
                    </div>

                    <p className="text-center text-sm text-gray-400 mt-4">
                        {text.noAccount}{' '}
                        <Link href={`/${lang}/pricing`} className="text-blue-400 hover:text-blue-300 font-medium">
                            {text.signup}
                        </Link>
                    </p>
                </form>
            </CardBody>
        </Card>
    );
}
