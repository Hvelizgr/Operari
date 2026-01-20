
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export class MemoryService {
    private static instance: MemoryService;
    // Simple in-memory storage: SessionID -> Messages[]
    private memories: Map<string, ChatMessage[]> = new Map();

    public static getInstance(): MemoryService {
        if (!MemoryService.instance) {
            MemoryService.instance = new MemoryService();
        }
        return MemoryService.instance;
    }

    async addMessage(sessionId: string, role: 'system' | 'user' | 'assistant', content: string): Promise<ChatMessage> {
        if (!this.memories.has(sessionId)) {
            this.memories.set(sessionId, []);
        }
        
        const message: ChatMessage = {
            role,
            content,
            timestamp: Date.now()
        };
        
        this.memories.get(sessionId)?.push(message);
        return message;
    }

    async getHistory(sessionId: string, limit: number = 20): Promise<ChatMessage[]> {
        const history = this.memories.get(sessionId) || [];
        // Return last N messages
        return history.slice(-limit);
    }

    async clearHistory(sessionId: string): Promise<void> {
        this.memories.delete(sessionId);
    }
}
