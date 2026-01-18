import { Response, NextFunction } from 'express';
import { credentialService, CreateCredentialInput } from '../services/credential.service';
import { AuthRequest } from '../types/express';
import { CustomError, ErrorCode } from '../errors/custom-error';

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

            // Optional: filter by environment from query
            const environment = req.query.environment as any;
            
            const credentials = await credentialService.getCredentials(userId, environment);

            res.json(credentials);
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
            const { id } = req.params;
            if (!userId) {
                throw new CustomError({ message: 'User ID required', code: ErrorCode.UNAUTHORIZED });
            }

            const updates = req.body;
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
            const { id } = req.params;
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
