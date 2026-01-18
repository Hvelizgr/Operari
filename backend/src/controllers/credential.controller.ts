import { Response, NextFunction } from 'express';
import { credentialService, CreateCredentialInput } from '../services/credential.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { CustomError, ErrorCode } from '../errors/custom-error';
import { CredentialEnvironment } from '@prisma/client';

export class CredentialController {
    
    /**
     * Create a new credential
     */
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User ID required', code: ErrorCode.UNAUTHORIZED });
            }

            const input: CreateCredentialInput = req.body;
            const credential = await credentialService.createCredential(userId, input);

            res.status(201).json(credential);
        } catch (error) {
            next(error);
        }
    }

    /**
     * List all credentials for the user
     */
    async list(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User ID required', code: ErrorCode.UNAUTHORIZED });
            }

            const id = req.query.id as string;
            
            if (id) {
                // Get one
                const cred = await credentialService.getCredential(id, req.user!.id);
                if (!cred) {
                    throw new CustomError({ message: 'Credential not found', code: ErrorCode.EXECUTION_NOT_FOUND });
                }
                res.json(cred);
            } else {
                // List all
                // Filter by environment if provided
                const environment = req.query.environment as CredentialEnvironment;
                
                const creds = await credentialService.getCredentials(req.user!.id, environment);
                res.json(creds);
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update a credential
     */
    async update(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            const id = req.params.id as string;
            if (!userId) {
                throw new CustomError({ message: 'User ID required', code: ErrorCode.UNAUTHORIZED });
            }

            const updates = req.body as Partial<CreateCredentialInput>;
            const credential = await credentialService.updateCredential(userId, id, updates);

            res.json(credential);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete a credential
     */
    async delete(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            const id = req.params.id as string;
            if (!userId) {
                throw new CustomError({ message: 'User ID required', code: ErrorCode.UNAUTHORIZED });
            }

            await credentialService.deleteCredential(userId, id);

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}

export const credentialController = new CredentialController();
