import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { prisma } from '../server';

export class TwoFactorService {
    private static instance: TwoFactorService;

    private constructor() {}

    public static getInstance(): TwoFactorService {
        if (!TwoFactorService.instance) {
            TwoFactorService.instance = new TwoFactorService();
        }
        return TwoFactorService.instance;
    }

    /**
     * Generate a new 2FA secret for a user
     */
    public async generateSecret(userId: string, email: string): Promise<{
        secret: string;
        qrCodeDataUrl: string;
        manualEntryKey: string;
    }> {
        const secret = speakeasy.generateSecret({
            name: `NanoFlow (${email})`,
            issuer: 'NanoFlow',
            length: 32
        });

        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url || '');

        // Store the secret temporarily (not enabled until verified)
        await prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorSecret: secret.base32,
                twoFactorEnabled: false
            }
        });

        return {
            secret: secret.base32,
            qrCodeDataUrl,
            manualEntryKey: secret.base32
        };
    }

    /**
     * Verify a TOTP token and enable 2FA
     */
    public async verifyAndEnable(userId: string, token: string): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { twoFactorSecret: true }
        });

        if (!user?.twoFactorSecret) {
            throw new Error('2FA secret not found. Please generate a new secret first.');
        }

        const isValid = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token,
            window: 2 // Allow 2 time steps tolerance
        });

        if (isValid) {
            // Generate backup codes
            const backupCodes = this.generateBackupCodes();
            
            await prisma.user.update({
                where: { id: userId },
                data: {
                    twoFactorEnabled: true,
                    twoFactorBackupCodes: backupCodes
                }
            });

            return true;
        }

        return false;
    }

    /**
     * Verify a TOTP token during login
     */
    public async verifyToken(userId: string, token: string): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { 
                twoFactorSecret: true, 
                twoFactorEnabled: true,
                twoFactorBackupCodes: true 
            }
        });

        if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
            return true; // 2FA not enabled, allow login
        }

        // First try TOTP
        const isValidTotp = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token,
            window: 2
        });

        if (isValidTotp) return true;

        // Try backup codes
        const backupCodes = user.twoFactorBackupCodes as string[] || [];
        const codeIndex = backupCodes.indexOf(token);
        
        if (codeIndex !== -1) {
            // Remove used backup code
            backupCodes.splice(codeIndex, 1);
            await prisma.user.update({
                where: { id: userId },
                data: { twoFactorBackupCodes: backupCodes }
            });
            return true;
        }

        return false;
    }

    /**
     * Disable 2FA for a user
     */
    public async disable(userId: string): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
                twoFactorBackupCodes: []
            }
        });
    }

    /**
     * Check if user has 2FA enabled
     */
    public async isEnabled(userId: string): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { twoFactorEnabled: true }
        });
        return user?.twoFactorEnabled || false;
    }

    /**
     * Generate backup codes
     */
    private generateBackupCodes(): string[] {
        const codes: string[] = [];
        for (let i = 0; i < 10; i++) {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            codes.push(code);
        }
        return codes;
    }

    /**
     * Regenerate backup codes
     */
    public async regenerateBackupCodes(userId: string): Promise<string[]> {
        const backupCodes = this.generateBackupCodes();
        
        await prisma.user.update({
            where: { id: userId },
            data: { twoFactorBackupCodes: backupCodes }
        });

        return backupCodes;
    }
}

export const twoFactorService = TwoFactorService.getInstance();
