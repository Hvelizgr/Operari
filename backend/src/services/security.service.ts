
import crypto from 'crypto';

export class SecurityService {
    private static instance: SecurityService;
    private readonly algorithm = 'aes-256-gcm';
    private readonly key: Buffer;

    private constructor() {
        const secret = process.env.ENCRYPTION_KEY || 'default_secret_key_32_chars_long!!';
        // Ensure key is 32 bytes
        this.key = crypto.scryptSync(secret, 'salt', 32);
    }

    public static getInstance(): SecurityService {
        if (!SecurityService.instance) {
            SecurityService.instance = new SecurityService();
        }
        return SecurityService.instance;
    }

    public encrypt(text: string): string {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag().toString('hex');
        
        // Format: iv:authTag:encryptedData
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    public decrypt(encryptedText: string): string {
        try {
            const [ivHex, authTagHex, encryptedData] = encryptedText.split(':');
            
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            throw new Error('Failed to decrypt data. Key might be invalid or data corrupted.');
        }
    }
}
