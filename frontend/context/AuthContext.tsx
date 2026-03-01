'use client';

import { create } from 'zustand';

interface User {
    id: string;
    email: string;
    role: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    setToken: (token: string | null) => void;
    setUser: (user: User | null) => void;
    logout: () => void;
}

const safeParseUser = (): User | null => {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem('nanoflow_user');
        if (!stored) return null;
        return JSON.parse(stored);
    } catch {
        localStorage.removeItem('nanoflow_user');
        return null;
    }
};

export const useAuthStore = create<AuthState>((set) => ({
    token: typeof window !== 'undefined' ? localStorage.getItem('nanoflow_token') : null,
    user: safeParseUser(),
    setToken: (token) => {
        if (token) localStorage.setItem('nanoflow_token', token);
        else localStorage.removeItem('nanoflow_token');
        set({ token });
    },
    setUser: (user) => {
        if (user) localStorage.setItem('nanoflow_user', JSON.stringify(user));
        else localStorage.removeItem('nanoflow_user');
        set({ user });
    },
    logout: () => {
        localStorage.removeItem('nanoflow_token');
        localStorage.removeItem('nanoflow_user');
        localStorage.removeItem('nanoflow_tenant');
        set({ token: null, user: null });
    },
}));
