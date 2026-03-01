
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTenant } from '@/hooks/useTenant';

interface ThemeConfig {
    primaryColor?: string;
    logoUrl?: string;
    companyName?: string;
    customCss?: string;
}

interface WhiteLabelContextType {
    config: ThemeConfig;
    isLoaded: boolean;
}

const WhiteLabelContext = createContext<WhiteLabelContextType>({
    config: {},
    isLoaded: false
});

export function WhiteLabelProvider({ children }: { children: React.ReactNode }) {
    const { tenant, loading } = useTenant();
    const [config, setConfig] = useState<ThemeConfig>({});

    useEffect(() => {
        if (tenant?.themeConfig) {
            const theme = tenant.themeConfig as ThemeConfig;
            setConfig(theme);

            // Apply primary color to CSS variables
            if (theme.primaryColor) {
                document.documentElement.style.setProperty('--primary', theme.primaryColor);
                // Assuming HeroUI/Tailwind uses some specific variables
                document.documentElement.style.setProperty('--heroui-primary', theme.primaryColor);
            }

            // Inject custom CSS if any
            if (theme.customCss) {
                const styleId = 'custom-tenant-css';
                let styleElement = document.getElementById(styleId);
                if (!styleElement) {
                    styleElement = document.createElement('style');
                    styleElement.id = styleId;
                    document.head.appendChild(styleElement);
                }
                styleElement.innerHTML = theme.customCss;
            }
        }
    }, [tenant]);

    return (
        <WhiteLabelContext.Provider value={{ config, isLoaded: !loading }}>
            {children}
        </WhiteLabelContext.Provider>
    );
}

export const useWhiteLabel = () => useContext(WhiteLabelContext);
