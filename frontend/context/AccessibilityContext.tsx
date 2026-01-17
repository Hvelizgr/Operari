'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AccessibilityContextType {
    highContrast: boolean;
    toggleHighContrast: () => void;
    announceMessage: (message: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
    // Start with false to match SSR - will be updated in useEffect
    const [highContrast, setHighContrast] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    // Track if component has mounted to prevent hydration mismatch
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        // Mark as mounted first
        setHasMounted(true);

        // Load preference from localStorage
        const saved = localStorage.getItem('nanoflow-high-contrast');
        if (saved) {
            setHighContrast(saved === 'true');
        } else {
            // Check system preference
            const systemPrefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches;
            if (systemPrefersHighContrast) {
                setHighContrast(true);
            }
        }
    }, []);

    const toggleHighContrast = () => {
        setHighContrast(prev => {
            const newValue = !prev;
            localStorage.setItem('nanoflow-high-contrast', String(newValue));
            return newValue;
        });
        announceMessage(highContrast ? 'Normal contrast mode enabled' : 'High contrast mode enabled');
    };

    const announceMessage = (message: string) => {
        setAnnouncement(message);
        // Increased timeout to give screen readers enough time to announce the message
        setTimeout(() => setAnnouncement(''), 1000);
    };

    // Only apply the high-contrast class after mounting to prevent hydration mismatch
    // Server and initial client render both have '' (empty string)
    const containerClassName = hasMounted && highContrast ? 'high-contrast' : '';

    return (
        <AccessibilityContext.Provider value={{ highContrast, toggleHighContrast, announceMessage }}>
            <div className={containerClassName}>
                {children}
                <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className="sr-only"
                >
                    {announcement}
                </div>
            </div>
        </AccessibilityContext.Provider>
    );
}

export function useAccessibility() {
    const context = useContext(AccessibilityContext);
    if (!context) {
        throw new Error('useAccessibility must be used within AccessibilityProvider');
    }
    return context;
}
