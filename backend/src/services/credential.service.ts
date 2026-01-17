
import { prisma } from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';
import { CustomError, ErrorCode } from '../errors/custom-error';

export class CredentialService {
    async createCredential(userId: string, name: string, type: string, data: Record<string, any>) {
        try {
            const encryptedData = encrypt(JSON.stringify(data));

            return await prisma.credential.create({
                data: {
                    userId,
                    name,
                    type,
                    data: encryptedData,
                },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    createdAt: true,
                }
            });
        } catch (error) {
            throw new CustomError({
                message: 'Failed to create credential',
                code: ErrorCode.DATABASE_OPERATION_FAILED,
                cause: error as Error
            });
        }
    }

    async getCredentials(userId: string) {
        try {
            return await prisma.credential.findMany({
                where: { userId },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            throw new CustomError({
                message: 'Failed to fetch credentials',
                code: ErrorCode.DATABASE_OPERATION_FAILED,
                cause: error as Error
            });
        }
    }

    async getCredentialInternal(userId: string, id: string) {
        const credential = await prisma.credential.findFirst({
            where: { id, userId },
        });

        if (!credential) {
            throw new CustomError({
                message: `Credential ${id} not found`,
                code: ErrorCode.CONFIGURATION_ERROR
            });
        }

        try {
            const decryptedData = JSON.parse(decrypt(credential.data));
            return {
                ...credential,
                data: decryptedData
            };
        } catch (error) {
            throw new CustomError({
                message: 'Failed to decrypt credential data',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    async deleteCredential(userId: string, id: string) {
        try {
            await prisma.credential.deleteMany({
                where: { id, userId }
            });
        } catch (error) {
            throw new CustomError({
                message: 'Failed to delete credential',
                code: ErrorCode.DATABASE_OPERATION_FAILED,
                cause: error as Error
            });
        }
    }
}

export const credentialService = new CredentialService();
