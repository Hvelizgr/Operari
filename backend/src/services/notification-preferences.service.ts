import { prisma } from '../server';

export interface NotificationPreferences {
    email: {
        workflowFailures: boolean;
        credentialExpiry: boolean;
        billingAlerts: boolean;
        weeklyDigest: boolean;
    };
    inApp: {
        workflowFailures: boolean;
        credentialExpiry: boolean;
        billingAlerts: boolean;
    };
    slack: {
        enabled: boolean;
        webhookUrl?: string;
        workflowFailures: boolean;
    };
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
    email: {
        workflowFailures: true,
        credentialExpiry: true,
        billingAlerts: true,
        weeklyDigest: false
    },
    inApp: {
        workflowFailures: true,
        credentialExpiry: true,
        billingAlerts: true
    },
    slack: {
        enabled: false,
        workflowFailures: true
    }
};

export class NotificationPreferencesService {
    private static instance: NotificationPreferencesService;

    private constructor() {}

    public static getInstance(): NotificationPreferencesService {
        if (!NotificationPreferencesService.instance) {
            NotificationPreferencesService.instance = new NotificationPreferencesService();
        }
        return NotificationPreferencesService.instance;
    }

    /**
     * Get user notification preferences
     */
    public async getPreferences(userId: string): Promise<NotificationPreferences> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { notificationPreferences: true }
        });

        if (!user?.notificationPreferences) {
            return DEFAULT_PREFERENCES;
        }

        return {
            ...DEFAULT_PREFERENCES,
            ...(user.notificationPreferences as object)
        } as NotificationPreferences;
    }

    /**
     * Update user notification preferences
     */
    public async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
        const current = await this.getPreferences(userId);
        
        const updated: NotificationPreferences = {
            email: { ...current.email, ...preferences.email },
            inApp: { ...current.inApp, ...preferences.inApp },
            slack: { ...current.slack, ...preferences.slack }
        };

        await prisma.user.update({
            where: { id: userId },
            data: { notificationPreferences: updated as any }
        });

        return updated;
    }

    /**
     * Check if user wants notification for a specific type
     */
    public async shouldNotify(userId: string, channel: 'email' | 'inApp' | 'slack', type: string): Promise<boolean> {
        const prefs = await this.getPreferences(userId);
        
        switch (channel) {
            case 'email':
                return (prefs.email as any)[type] ?? true;
            case 'inApp':
                return (prefs.inApp as any)[type] ?? true;
            case 'slack':
                return prefs.slack.enabled && ((prefs.slack as any)[type] ?? true);
            default:
                return true;
        }
    }
}

export const notificationPreferencesService = NotificationPreferencesService.getInstance();
