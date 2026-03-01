
import { Request, Response } from 'express';
import { InstanceService } from '../services/instance.service';
import { ProcessMiningService } from '../services/process-mining.service';

export class AdminController {
    private instanceService: InstanceService;
    private processMiningService: ProcessMiningService;

    constructor() {
        this.instanceService = InstanceService.getInstance();
        this.processMiningService = ProcessMiningService.getInstance();
    }

    getInstances = async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const instances = await this.instanceService.getInstances(tenantId);
            res.json(instances);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching instances', error: (error as Error).message });
        }
    };

    createInstance = async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const instance = await this.instanceService.createInstance(tenantId, req.body);
            res.status(201).json(instance);
        } catch (error) {
            res.status(500).json({ message: 'Error creating instance', error: (error as Error).message });
        }
    };

    refreshInstance = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;
            const instance = await this.instanceService.refreshInstanceStatus(id);
            res.json(instance);
        } catch (error) {
            res.status(500).json({ message: 'Error refreshing instance', error: (error as Error).message });
        }
    };

    deleteInstance = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;
            await this.instanceService.deleteInstance(id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ message: 'Error deleting instance', error: (error as Error).message });
        }
    };

    getProcessMining = async (req: Request, res: Response) => {
        try {
            const workflowId = req.params.workflowId as string;
            const stats = await this.processMiningService.analyzeWorkflow(workflowId);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ message: 'Error analyzing process', error: (error as Error).message });
        }
    };

    getGlobalBottlenecks = async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).user.tenantId;
            const bottlenecks = await this.processMiningService.getGlobalBottlenecks(tenantId);
            res.json(bottlenecks);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching global bottlenecks', error: (error as Error).message });
        }
    };
}

export const adminController = new AdminController();
