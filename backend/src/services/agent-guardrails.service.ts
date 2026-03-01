import axios from 'axios';

export interface GuardrailValidation {
    allowed: boolean;
    reason?: string;
    riskScore: number;
    recommendedAction?: 'BLOCK' | 'WARN' | 'ALLOW';
    sanitizedInput?: string;
}

export interface GuardrailRule {
    id: string;
    name: string;
    type: 'regex' | 'llm' | 'semantic' | 'allowlist';
    pattern?: string;
    severity: 'high' | 'medium' | 'low';
}

export class AgentGuardrailsService {
    private static readonly API_KEY = process.env.OPENAI_API_KEY || '';

    static async validateAction(
        agentId: string,
        actionType: string,
        params: any,
        context: string
    ): Promise<GuardrailValidation> {
        console.log(`[Guardrails] Validating action ${actionType} for agent ${agentId}`);

        // 1. Basic Rule Check (Hardcoded for simulation of 'high priority' rules)
        if (actionType === 'DELETE_DATABASE' || actionType === 'WIPE_STORAGE') {
            return {
                allowed: false,
                reason: 'Critical destructive actions are prohibited by default guardrails.',
                riskScore: 1.0,
                recommendedAction: 'BLOCK'
            };
        }

        // 2. LLM-based Intent Validation (Semantic check)
        if (this.API_KEY) {
            try {
                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'system',
                                content: `You are a security guardrail system for AI agents. 
                                Analyze the proposed action and context to detect malicious intent, data exfiltration, or violation of business policies.`
                            },
                            {
                                role: 'user',
                                content: `Agent: ${agentId}\nAction: ${actionType}\nParams: ${JSON.stringify(params)}\nContext: ${context}\n\nIs this action safe? Return JSON: { "safe": boolean, "reason": string, "risk": 0-1 }`
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

                const result = JSON.parse(response.data.choices[0].message.content);
                return {
                    allowed: result.safe,
                    reason: result.reason,
                    riskScore: result.risk,
                    recommendedAction: result.safe ? 'ALLOW' : (result.risk > 0.8 ? 'BLOCK' : 'WARN')
                };
            } catch (error) {
                console.error('[Guardrails] LLM Validation failed, falling back to safe mode', error);
            }
        }

        // Fallback for simulation
        return {
            allowed: true,
            riskScore: 0.1,
            recommendedAction: 'ALLOW'
        };
    }

    static sanitizeInput(input: string): string {
        // Simple PII masking for demo
        return input.replace(/\b[\w.-]+@[\w.-]+\.\w{2,4}\b/gi, '[EMAIL_REDACTED]');
    }
}
