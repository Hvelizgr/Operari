
import { Response, NextFunction } from 'express';
import { credentialService } from '../services/credential.service';
import { CustomError, ErrorCode } from '../errors/custom-error';
import { AuthRequest } from '../middleware/auth.middleware';

export class CredentialController {
    async create(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { name, type, data } = req.body;

            if (!name || !type || !data) {
                throw new CustomError({ message: 'Missing required fields', code: ErrorCode.VALIDATION_ERROR });
            }

            const credential = await credentialService.createCredential(userId, name, type, data);
            res.status(201).json(credential);
        } catch (error) {
            next(error);
        }
    }

    async getAll(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });

            const credentials = await credentialService.getCredentials(userId);
            res.json(credentials);
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
