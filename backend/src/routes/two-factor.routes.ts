import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { twoFactorService } from '../services/two-factor.service';
import { auditService, AuditAction } from '../services/audit.service';

const router = Router();

/**
 * @swagger
 * /2fa/setup:
 *   post:
 *     summary: Generate 2FA secret and QR code
 *     tags: [2FA]
 */
router.post('/setup', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const email = req.user!.email;

        const result = await twoFactorService.generateSecret(userId, email);

        res.json({
            qrCode: result.qrCodeDataUrl,
            manualKey: result.manualEntryKey,
            message: 'Scan the QR code with your authenticator app, then verify with a code.'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /2fa/verify:
 *   post:
 *     summary: Verify TOTP code and enable 2FA
 *     tags: [2FA]
 */
router.post('/verify', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const isValid = await twoFactorService.verifyAndEnable(userId, token);

        if (isValid) {
            await auditService.log({
                tenantId: req.user!.tenantId,
                userId,
                action: AuditAction.LOGIN, // Using LOGIN as closest action
                resourceType: '2FA',
                resourceId: userId,
                details: { action: '2FA_ENABLED' }
            });

            res.json({ 
                success: true, 
                message: '2FA has been enabled successfully!' 
            });
        } else {
            res.status(400).json({ 
                success: false, 
                error: 'Invalid verification code' 
            });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /2fa/disable:
 *   post:
 *     summary: Disable 2FA
 *     tags: [2FA]
 */
router.post('/disable', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const { token } = req.body;

        // Verify current 2FA token before disabling
        const isValid = await twoFactorService.verifyToken(userId, token);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        await twoFactorService.disable(userId);

        await auditService.log({
            tenantId: req.user!.tenantId,
            userId,
            action: AuditAction.LOGIN,
            resourceType: '2FA',
            resourceId: userId,
            details: { action: '2FA_DISABLED' }
        });

        res.json({ success: true, message: '2FA has been disabled' });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /2fa/status:
 *   get:
 *     summary: Check 2FA status for current user
 *     tags: [2FA]
 */
router.get('/status', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const isEnabled = await twoFactorService.isEnabled(userId);

        res.json({ enabled: isEnabled });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /2fa/backup-codes:
 *   post:
 *     summary: Regenerate backup codes
 *     tags: [2FA]
 */
router.post('/backup-codes', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const { token } = req.body;

        // Verify current 2FA token before regenerating
        const isValid = await twoFactorService.verifyToken(userId, token);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        const codes = await twoFactorService.regenerateBackupCodes(userId);

        res.json({ 
            codes,
            message: 'Save these backup codes in a safe place. Each code can only be used once.'
        });
    } catch (error) {
        next(error);
    }
});

export default router;
