'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardBody, Spinner, Button } from '@heroui/react';
import { CheckCircle, XCircle, Mail, ArrowRight } from 'lucide-react';
import { GridPattern } from '@/components/ui/GridPattern';
import { apiClient } from '@/utils/api-client';
import { useAuthStore } from '../../../context/AuthContext';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading');
    const [message, setMessage] = useState('');
    const { setUser, setToken } = useAuthStore();

    useEffect(() => {
        if (!token) {
            setStatus('no-token');
            return;
        }

        const verifyEmail = async () => {
            try {
                const response = await apiClient.post('/auth/verify-email', { token });
                setStatus('success');
                setMessage(response.data.message || 'Email verified successfully!');
                
                if (response.data.token && response.data.user) {
                    setUser(response.data.user);
                    setToken(response.data.token);
                    setTimeout(() => {
                        router.push('/dashboard');
                    }, 2000);
                }
            } catch (error: any) {
                setStatus('error');
                setMessage(error.response?.data?.error || 'Failed to verify email. The link may have expired.');
            }
        };

        verifyEmail();
    }, [token, router, setUser, setToken]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-black/95 relative overflow-hidden">
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <GridPattern
                    width={50}
                    height={50}
                    x={-1}
                    y={-1}
                    strokeDasharray="4 2"
                    className="stroke-blue-500/10 [mask-image:radial-gradient(1000px_circle_at_center,white,transparent)]"
                />
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
            </div>

            <Card className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 z-10">
                <CardBody className="p-8 text-center">
                    {status === 'loading' && (
                        <>
                            <Spinner size="lg" className="mb-4" />
                            <h2 className="text-xl font-semibold mb-2">Verifying your email...</h2>
                            <p className="text-gray-400">Please wait while we verify your email address.</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">Email Verified!</h2>
                            <p className="text-gray-400 mb-6">{message}</p>
                            <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                                <XCircle className="w-8 h-8 text-red-500" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">Verification Failed</h2>
                            <p className="text-gray-400 mb-6">{message}</p>
                            <div className="space-y-3">
                                <Button
                                    color="primary"
                                    className="w-full"
                                    onPress={() => router.push('/login')}
                                    endContent={<ArrowRight size={16} />}
                                >
                                    Go to Login
                                </Button>
                            </div>
                        </>
                    )}

                    {status === 'no-token' && (
                        <>
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                <Mail className="w-8 h-8 text-yellow-500" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">No Verification Token</h2>
                            <p className="text-gray-400 mb-6">
                                Please check your email for the verification link, or request a new one.
                            </p>
                            <Button
                                color="primary"
                                className="w-full"
                                onPress={() => router.push('/login')}
                                endContent={<ArrowRight size={16} />}
                            >
                                Go to Login
                            </Button>
                        </>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

function VerifyEmailFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black/95 relative overflow-hidden">
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <GridPattern
                    width={50}
                    height={50}
                    x={-1}
                    y={-1}
                    strokeDasharray="4 2"
                    className="stroke-blue-500/10 [mask-image:radial-gradient(1000px_circle_at_center,white,transparent)]"
                />
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
            </div>

            <Card className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 z-10">
                <CardBody className="p-8 text-center">
                    <Spinner size="lg" className="mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Loading...</h2>
                </CardBody>
            </Card>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<VerifyEmailFallback />}>
            <VerifyEmailContent />
        </Suspense>
    );
}
