
import { Request, Response } from 'express';
import { GlobalVariableService } from '../services/global-variable.service';

export class GlobalVariableController {
    private globalVariableService: GlobalVariableService;

    constructor() {
        this.globalVariableService = GlobalVariableService.getInstance();
    }

    getVariables = async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const variables = await this.globalVariableService.getVariables(tenantId);
            res.json(variables);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching variables', error: (error as Error).message });
        }
    };

    createVariable = async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const variable = await this.globalVariableService.createVariable(tenantId, req.body);
            res.status(201).json(variable);
        } catch (error) {
            res.status(500).json({ message: 'Error creating variable', error: (error as Error).message });
        }
    };

    updateVariable = async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const id = req.params.id as string;
            const variable = await this.globalVariableService.updateVariable(id, tenantId, req.body);
            res.json(variable);
        } catch (error) {
            res.status(500).json({ message: 'Error updating variable', error: (error as Error).message });
        }
    };

    deleteVariable = async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const id = req.params.id as string;
            await this.globalVariableService.deleteVariable(id, tenantId);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ message: 'Error deleting variable', error: (error as Error).message });
        }
    };

    syncVariables = async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            await this.globalVariableService.syncWithInstances(tenantId);
            res.json({ message: 'Synchronization triggered' });
        } catch (error) {
            res.status(500).json({ message: 'Error syncing variables', error: (error as Error).message });
        }
    };

    propagateVariables = async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const result = await this.globalVariableService.propagateToFleet(tenantId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ message: 'Propagation failed', error: (error as Error).message });
        }
    };
}

export const globalVariableController = new GlobalVariableController();
