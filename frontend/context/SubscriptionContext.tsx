'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type PlanType = 'student' | 'pro' | 'enterprise';
export type UserRole = 'viewer' | 'editor' | 'admin';

interface SubscriptionContextType {
    plan: PlanType;
    role: UserRole;
    setPlan: (plan: PlanType) => void;
    setRole: (role: UserRole) => void;
    features: {
        canAccessAPI: boolean;
        canAccessAuditLogs: boolean;
        canAccessAdvancedNodes: boolean;
        maxExecutions: number;
    };
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const [plan, setPlanState] = useState<PlanType>('student');
    const [role, setRoleState] = useState<UserRole>('editor');

    // Load from local storage on mount (simulate persistence)
    useEffect(() => {
        const savedPlan = localStorage.getItem('nanoflow_plan') as PlanType;
        const savedRole = localStorage.getItem('nanoflow_role') as UserRole;
        if (savedPlan) setPlanState(savedPlan);
        if (savedRole) setRoleState(savedRole);
    }, []);

    const setPlan = (newPlan: PlanType) => {
        setPlanState(newPlan);
        localStorage.setItem('nanoflow_plan', newPlan);
    };

    const setRole = (newRole: UserRole) => {
        setRoleState(newRole);
        localStorage.setItem('nanoflow_role', newRole);
    }

    // specific feature flags based on plan
    const features = {
        canAccessAPI: plan === 'pro' || plan === 'enterprise',
        canAccessAuditLogs: plan === 'enterprise',
        canAccessAdvancedNodes: plan !== 'student',
        maxExecutions: plan === 'student' ? 100 : (plan === 'pro' ? 50000 : 999999999),
    };

    return (
        <SubscriptionContext.Provider value={{ plan, role, setPlan, setRole, features }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription() {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription must be used within SubscriptionProvider');
    }
    return context;
}
