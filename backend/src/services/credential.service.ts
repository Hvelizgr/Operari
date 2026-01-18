import { prisma } from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';
import { CustomError, ErrorCode } from '../errors/custom-error';
import { CredentialEnvironment } from '@prisma/client';

export interface CredentialScope {
    environment?: CredentialEnvironment;
    allowedWorkflows?: string[];
    allowedTags?: string[];
}

export interface CreateCredentialInput {
    name: string;
    type: string;
    data: Record<string, any>;
    description?: string;
    scope?: CredentialScope;
}

export interface CredentialAccessContext {
    workflowId?: string;
    workflowTags?: string[];
    environment?: CredentialEnvironment;
}

export class CredentialService {
    async createCredential(userId: string, input: CreateCredentialInput) {
        const { name, type, data, description, scope } = input;

        try {
            const encryptedData = encrypt(JSON.stringify(data));

            return await prisma.credential.create({
                data: {
                    userId,
                    name,
                    type,
                    data: encryptedData,
                    description,
                    environment: scope?.environment || 'ALL',
                    allowedWorkflows: scope?.allowedWorkflows || [],
                    allowedTags: scope?.allowedTags || [],
                },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    description: true,
                    environment: true,
                    allowedWorkflows: true,
                    allowedTags: true,
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

    async getCredential(id: string, userId: string) {
        const cred = await prisma.credential.findFirst({
            where: { id, userId },
            select: {
                id: true,
                name: true,
                type: true,
                description: true,
                environment: true,
                allowedWorkflows: true,
                allowedTags: true,
                createdAt: true,
            }
        });
        return cred;
    }

    async getCredentials(userId: string, environment?: CredentialEnvironment) {
        try {
            const where: any = { userId };

            // Filter by environment if specified
            if (environment && environment !== 'ALL') {
                where.OR = [
                    { environment: environment },
                    { environment: 'ALL' }
                ];
            }

            return await prisma.credential.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    description: true,
                    environment: true,
                    allowedWorkflows: true,
                    allowedTags: true,
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

    /**
     * Get credential for internal use (execution) with scope validation
     */
    async getCredentialInternal(
        userId: string,
        id: string,
        context?: CredentialAccessContext
    ) {
        const credential = await prisma.credential.findFirst({
            where: { id, userId },
        });

        if (!credential) {
            throw new CustomError({
                message: `Credential ${id} not found`,
                code: ErrorCode.CONFIGURATION_ERROR
            });
        }

        // Validate scope if context is provided
        if (context) {
            this.validateAccess(credential, context);
        }

        try {
            const decryptedData = JSON.parse(decrypt(credential.data));
            return {
                id: credential.id,
                name: credential.name,
                type: credential.type,
                data: decryptedData,
                environment: credential.environment,
            };
        } catch (error) {
            throw new CustomError({
                message: 'Failed to decrypt credential data',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    /**
     * Validate if credential can be accessed in the given context
     */
    private validateAccess(
        credential: {
            environment: CredentialEnvironment;
            allowedWorkflows: string[];
            allowedTags: string[];
        },
        context: CredentialAccessContext
    ): void {
        // Check environment
        if (credential.environment !== 'ALL' && context.environment) {
            if (credential.environment !== context.environment) {
                throw new CustomError({
                    message: `Credential not allowed in ${context.environment} environment`,
                    code: ErrorCode.CONFIGURATION_ERROR
                });
            }
        }

        // Check workflow restriction
        if (credential.allowedWorkflows.length > 0 && context.workflowId) {
            if (!credential.allowedWorkflows.includes(context.workflowId)) {
                throw new CustomError({
                    message: 'Credential not allowed for this workflow',
                    code: ErrorCode.CONFIGURATION_ERROR
                });
            }
        }

        // Check tag restriction
        if (credential.allowedTags.length > 0 && context.workflowTags) {
            const hasMatchingTag = context.workflowTags.some(tag =>
                credential.allowedTags.includes(tag)
            );
            if (!hasMatchingTag) {
                throw new CustomError({
                    message: 'Credential not allowed for workflows with these tags',
                    code: ErrorCode.CONFIGURATION_ERROR
                });
            }
        }
    }

    /**
     * Get credentials available for a specific workflow context
     */
    async getCredentialsForWorkflow(
        userId: string,
        workflowId: string,
        workflowTags: string[] = [],
        environment: CredentialEnvironment = 'ALL'
    ) {
        try {
            const allCredentials = await prisma.credential.findMany({
                where: { userId },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    description: true,
                    environment: true,
                    allowedWorkflows: true,
                    allowedTags: true,
                    createdAt: true,
                },
            });

            // Filter credentials based on scope
            return allCredentials.filter(cred => {
                // Environment check
                if (cred.environment !== 'ALL' && environment !== 'ALL') {
                    if (cred.environment !== environment) return false;
                }

                // Workflow restriction check
                if (cred.allowedWorkflows.length > 0) {
                    if (!cred.allowedWorkflows.includes(workflowId)) return false;
                }

                // Tag restriction check
                if (cred.allowedTags.length > 0) {
                    const hasMatchingTag = workflowTags.some(tag =>
                        cred.allowedTags.includes(tag)
                    );
                    if (!hasMatchingTag) return false;
                }

                return true;
            });
        } catch (error) {
            throw new CustomError({
                message: 'Failed to fetch credentials for workflow',
                code: ErrorCode.DATABASE_OPERATION_FAILED,
                cause: error as Error
            });
        }
    }

    async updateCredential(
        userId: string,
        id: string,
        updates: Partial<CreateCredentialInput>
    ) {
        try {
            const updateData: any = {};

            if (updates.name) updateData.name = updates.name;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.data) updateData.data = encrypt(JSON.stringify(updates.data));
            if (updates.scope?.environment) updateData.environment = updates.scope.environment;
            if (updates.scope?.allowedWorkflows) updateData.allowedWorkflows = updates.scope.allowedWorkflows;
            if (updates.scope?.allowedTags) updateData.allowedTags = updates.scope.allowedTags;

            return await prisma.credential.update({
                where: { id, userId },
                data: updateData,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    description: true,
                    environment: true,
                    allowedWorkflows: true,
                    allowedTags: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });
        } catch (error) {
            throw new CustomError({
                message: 'Failed to update credential',
                code: ErrorCode.DATABASE_OPERATION_FAILED,
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
