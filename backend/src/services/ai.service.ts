import axios from 'axios';
import { WorkflowNode, WorkflowConnection } from '../types/workflow.types';

export interface AIGenerationResult {
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
    explanation: string;
}

export class AIService {
    private static readonly API_KEY = process.env.OPENAI_API_KEY || '';
    private static readonly API_URL = 'https://api.openai.com/v1/chat/completions';

    static async generateWorkflow(prompt: string): Promise<AIGenerationResult> {
        if (!this.API_KEY) {
            return this.getMockResponse(prompt);
        }

        try {
            const response = await axios.post(
                this.API_URL,
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expert workflow architect for NanoFlow.
                            Your task is to generate workflow JSON based on user requirements.
                            
                            NanoFlow uses a node-based architecture similar to n8n.
                            Nodes have: id, type, title, position (x, y), config.
                            Connections have: id, source, target, sourcePort? (0 for success, 1 for failure in IF nodes).
                            
                            Supported Node Types:
                            - n8n-nodes-base.manualTrigger (Start)
                            - n8n-nodes-base.httpRequest (GET, POST, etc)
                            - n8n-nodes-base.code (JavaScript)
                            - n8n-nodes-base.if (Conditional logic)
                            - n8n-nodes-base.wait (Delay)
                            - n8n-nodes-base.switch (Routing)
                            
                            Return ONLY a JSON object with:
                            {
                                "nodes": [...],
                                "connections": [...],
                                "explanation": "Brief explanation of what the workflow does"
                            }`
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    response_format: { type: 'json_object' }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return JSON.parse(response.data.choices[0].message.content);
        } catch (error) {
            console.error('Error generating workflow with AI:', error);
            return this.getMockResponse(prompt);
        }
    }

    private static getMockResponse(prompt: string): AIGenerationResult {
        // Simple mock for when no API key is present
        console.warn('AI API Key not found, returning mock response');
        
        if (prompt.toLowerCase().includes('weather')) {
            return {
                nodes: [
                    { id: 'node-1', type: 'n8n-nodes-base.manualTrigger', title: 'Start', position: { x: 100, y: 200 }, config: {} },
                    { id: 'node-2', type: 'n8n-nodes-base.httpRequest', title: 'Get Weather', position: { x: 350, y: 200 }, config: { url: 'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current_weather=true', method: 'GET' } },
                    { id: 'node-3', type: 'n8n-nodes-base.code', title: 'Format Data', position: { x: 600, y: 200 }, config: { jsCode: 'return { temp: input.data.current_weather.temperature };' } }
                ],
                connections: [
                    { id: 'c1', source: 'node-1', target: 'node-2' },
                    { id: 'c2', source: 'node-2', target: 'node-3' }
                ],
                explanation: "This workflow fetches current weather for NYC and formats the temperature output."
            };
        }

        return {
            nodes: [
                { id: 'node-1', type: 'n8n-nodes-base.manualTrigger', title: 'Start', position: { x: 100, y: 200 }, config: {} },
                { id: 'node-2', type: 'n8n-nodes-base.code', title: 'Hello World', position: { x: 400, y: 200 }, config: { jsCode: 'return { message: "AI Generated!" };' } }
            ],
            connections: [
                { id: 'c1', source: 'node-1', target: 'node-2' }
            ],
            explanation: "Default fallback: Simple hello world trigger."
        };
    }
}
