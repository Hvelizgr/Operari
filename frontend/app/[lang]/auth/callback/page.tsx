'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Spinner } from '@heroui/react';
import { useAuthStore } from '../../../../context/AuthContext';

function AuthCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const { setToken, setUser } = useAuthStore();

    useEffect(() => {
        const token = searchParams.get('token');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            setError(getErrorMessage(errorParam));
            setTimeout(() => {
                router.push('/login');
            }, 3000);
            return;
        }

        if (token) {
            localStorage.setItem('nanoflow_token', token);
            setToken(token);

            const payload = JSON.parse(atob(token.split('.')[1]));
            const user = {
                id: payload.userId,
                email: payload.email,
                role: payload.role,
            };
            localStorage.setItem('nanoflow_user', JSON.stringify(user));
            setUser(user);

            router.push('/dashboard');
        } else {
            setError('No authentication token received');
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        }
    }, [searchParams, router, setToken, setUser]);

    const getErrorMessage = (code: string): string => {
        switch (code) {
            case 'no_code':
                return 'Authentication was cancelled or failed. Please try again.';
            case 'token_error':
                return 'Failed to complete authentication. Please try again.';
            case 'no_email':
                return 'Could not retrieve your email from the provider.';
            case 'oauth_error':
                return 'An error occurred during authentication. Please try again.';
            default:
                return 'Authentication failed. Please try again.';
        }
    };

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">Authentication Failed</h2>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <p className="text-sm text-gray-500">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="text-center">
                <Spinner size="lg" className="mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Completing authentication...</h2>
                <p className="text-gray-400">Please wait while we sign you in.</p>
            </div>
        </div>
    );
}

function AuthCallbackFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="text-center">
                <Spinner size="lg" className="mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Loading...</h2>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<AuthCallbackFallback />}>
            <AuthCallbackContent />
        </Suspense>
    );
}
