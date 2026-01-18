import { Response, NextFunction } from 'express';
import { credentialService } from '../services/credential.service';
import { CustomError, ErrorCode } from '../errors/custom-error';
import { AuthRequest } from '../middleware/auth.middleware';
import { CredentialEnvironment } from '@prisma/client';

export class CredentialController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { name, type, data, description, scope } = req.body;

            if (!name || !type || !data) {
                throw new CustomError({ message: 'Missing required fields: name, type, data', code: ErrorCode.VALIDATION_ERROR });
            }

            // Validate scope if provided
            if (scope?.environment && !['DEVELOPMENT', 'STAGING', 'PRODUCTION', 'ALL'].includes(scope.environment)) {
                throw new CustomError({ message: 'Invalid environment. Must be DEVELOPMENT, STAGING, PRODUCTION, or ALL', code: ErrorCode.VALIDATION_ERROR });
            }

            const credential = await credentialService.createCredential(userId, {
                name,
                type,
                data,
                description,
                scope
            });
            res.status(201).json(credential);
        } catch (error) {
            next(error);
        }
    }

    async getAll(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });

            const environment = req.query.environment as CredentialEnvironment | undefined;

            const credentials = await credentialService.getCredentials(userId, environment);
            res.json(credentials);
        } catch (error) {
            next(error);
        }
    }

    async getForWorkflow(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });

            const workflowId = req.params.workflowId as string;
            const tags = req.query.tags ? (req.query.tags as string).split(',') : [];
            const environment = (req.query.environment as CredentialEnvironment) || 'ALL';

            if (!workflowId) {
                throw new CustomError({ message: 'Workflow ID is required', code: ErrorCode.VALIDATION_ERROR });
            }

            const credentials = await credentialService.getCredentialsForWorkflow(
                userId,
                workflowId,
                tags,
                environment
            );
            res.json(credentials);
        } catch (error) {
            next(error);
        }
    }

    async update(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            const id = req.params.id as string;
            if (!userId) throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });

            const { name, data, description, scope } = req.body;

            // Validate scope if provided
            if (scope?.environment && !['DEVELOPMENT', 'STAGING', 'PRODUCTION', 'ALL'].includes(scope.environment)) {
                throw new CustomError({ message: 'Invalid environment', code: ErrorCode.VALIDATION_ERROR });
            }

            const credential = await credentialService.updateCredential(userId, id, {
                name,
                data,
                description,
                scope
            });
            res.json(credential);
        } catch (error) {
            next(error);
        }
    }

    async delete(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            const id = req.params.id as string;
            if (!userId) throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });

            await credentialService.deleteCredential(userId, id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}

export const credentialController = new CredentialController();
