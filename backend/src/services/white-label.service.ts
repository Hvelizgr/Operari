
import { PrismaClient } from '@prisma/client';

export interface ThemeConfig {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
    supportEmail?: string;
    customDomain?: string;
    faviconUrl?: string;
}

export class WhiteLabelService {
    private prisma: PrismaClient;
    private static instance: WhiteLabelService;

    private constructor() {
        this.prisma = new PrismaClient();
    }

    public static getInstance(): WhiteLabelService {
        if (!WhiteLabelService.instance) {
            WhiteLabelService.instance = new WhiteLabelService();
        }
        return WhiteLabelService.instance;
    }

    async getThemeConfig(tenantId: string): Promise<ThemeConfig | null> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { themeConfig: true }
        });

        return tenant?.themeConfig as unknown as ThemeConfig;
    }

    async updateThemeConfig(tenantId: string, config: Partial<ThemeConfig>): Promise<void> {
        const currentConfig = await this.getThemeConfig(tenantId) || {};
        const newConfig = { ...currentConfig, ...config };

        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { themeConfig: newConfig as any }
        });
    }

    async getThemeBySlug(slug: string): Promise<ThemeConfig | null> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { slug },
            select: { themeConfig: true }
        });

        return tenant?.themeConfig as unknown as ThemeConfig;
    }
}
