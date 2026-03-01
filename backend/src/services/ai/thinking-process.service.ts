import { Thought, ThinkingProcess } from '../../types/ai.types';
import { v4 as uuidv4 } from 'uuid';

export class ThinkingProcessService {
    private static instance: ThinkingProcessService;
    private processes: Map<string, Thought[]> = new Map();

    private constructor() {}

    public static getInstance(): ThinkingProcessService {
        if (!ThinkingProcessService.instance) {
            ThinkingProcessService.instance = new ThinkingProcessService();
        }
        return ThinkingProcessService.instance;
    }

    async addStep(sessionId: string, step: Omit<Thought, 'id' | 'sessionId' | 'timestamp'>): Promise<Thought> {
        if (!this.processes.has(sessionId)) {
            this.processes.set(sessionId, []);
        }

        const thought: Thought = {
            id: uuidv4(),
            sessionId,
            timestamp: Date.now(),
            ...step,
        };

        this.processes.get(sessionId)?.push(thought);
        return thought;
    }

    async getProcess(sessionId: string): Promise<ThinkingProcess> {
        return {
            sessionId,
            steps: this.processes.get(sessionId) || [],
        };
    }

    async clearProcess(sessionId: string): Promise<void> {
        this.processes.delete(sessionId);
    }
}

export const thinkingProcessService = ThinkingProcessService.getInstance();
