
export interface Thought {
    id: string;
    sessionId: string;
    timestamp: number;
    title: string;
    content: string;
    type: 'reasoning' | 'action' | 'observation' | 'error';
    metadata?: Record<string, any>;
}

export interface ThinkingProcess {
    sessionId: string;
    steps: Thought[];
}
