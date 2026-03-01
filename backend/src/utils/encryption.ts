
import crypto from 'crypto';
import { CustomError, ErrorCode, ErrorSeverity } from '../errors/custom-error';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const _SALT_LENGTH = 64;
// Key length for AES-256 is 32 bytes

function getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new CustomError({
            message: 'ENCRYPTION_KEY environment variable not set',
            code: ErrorCode.CONFIGURATION_ERROR,
            severity: ErrorSeverity.CRITICAL
        });
    }
    if (key.length < 16) {
        throw new CustomError({
            message: 'ENCRYPTION_KEY must be at least 16 characters for security',
            code: ErrorCode.CONFIGURATION_ERROR,
            severity: ErrorSeverity.CRITICAL
        });
    }
    // Hash the key to ensure 32 bytes length
    return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypts a string using AES-256-GCM
 */
export function encrypt(text: string): string {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const masterKey = getKey();

        const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const tag = cipher.getAuthTag();

        // Format: iv:tag:encrypted
        return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
    } catch (error) {
        throw new CustomError({
            message: 'Failed to encrypt data',
            code: ErrorCode.UNKNOWN_ERROR,
            cause: error as Error
        });
    }
}

/**
 * Decrypts a string using AES-256-GCM
 */
export function decrypt(text: string): string {
    try {
        const parts = text.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted text format');
        }

        const [ivHex, tagHex, encryptedHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const masterKey = getKey();

        const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        throw new CustomError({
            message: 'Failed to decrypt data',
            code: ErrorCode.UNKNOWN_ERROR,
            cause: error as Error
        });
    }
}
