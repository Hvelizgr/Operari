import axios from 'axios';
import { WorkflowNode, WorkflowConnection } from '../types/workflow.types';

const safeJsonParse = <T>(content: string, fallback: T): T => {
    try {
        return JSON.parse(content);
    } catch {
        console.error('Failed to parse AI response as JSON:', content.substring(0, 200));
        return fallback;
    }
};

export interface AIGenerationResult {
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
    explanation: string;
}

export interface AISuggestion {
    nodeType: string;
    reason: string;
    configPreview?: Record<string, any>;
}

export interface WorkflowDocumentation {
    summary: string;
    useCases: string[];
    prerequisites: string[];
    nodesDescription: Array<{ nodeId: string; description: string }>;
    dataFlow: string;
}

export interface FailurePrediction {
    nodeId: string;
    riskLevel: 'high' | 'medium' | 'low';
    potentialIssue: string;
    recommendation: string;
}

export interface WorkflowOptimization {
    type: 'performance' | 'reliability' | 'cost' | 'simplicity';
    description: string;
    impact: string;
    actionableFix?: string;
}

export interface AISuggestConfigResult {
    config: Record<string, any>;
    explanation: string;
}

export interface DebugAnalysis {
    summary: string;
    rootCause: string;
    affectedNodes: string[];
    suggestedFixes: Array<{
        nodeId: string;
        action: string;
        description: string;
        code?: string;
    }>;
    relatedDocs?: string[];
    confidence: 'high' | 'medium' | 'low';
}

export interface DebugContext {
    workflowId: string;
    executionId?: string;
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
    nodeLogs?: Array<{
        nodeId: string;
        nodeName: string;
        nodeType: string;
        status: string;
        input?: unknown;
        output?: unknown;
        error?: string;
        duration?: number;
    }>;
    executionError?: string;
}

export class AIService {
    private static readonly API_KEY = process.env.OPENAI_API_KEY || '';
    private static readonly API_URL = 'https://api.openai.com/v1/chat/completions';

    static async suggestNodeConfig(
        node: any,
        workflowContext: { nodes: any[]; connections: any[] },
        language: string = 'en'
    ): Promise<AISuggestConfigResult> {
        if (!this.API_KEY) {
            return {
                config: node.config || {},
                explanation: "AI service not configured. Set OPENAI_API_KEY."
            };
        }

        try {
            const prompt = `Suggest a complete and functional configuration for this node in the context of the current workflow.
            
            Node to configure:
            Type: ${node.type}
            Current Title: ${node.title}
            Current Config: ${JSON.stringify(node.config)}
            
            Workflow Context:
            Nearby Nodes: ${JSON.stringify(workflowContext.nodes.filter(n => n.id !== node.id))}
            Connections: ${JSON.stringify(workflowContext.connections)}
            
            Return ONLY a JSON object with:
            {
                "config": { ...suggested properties... },
                "explanation": "Brief explanation of why these values were suggested in ${language}"
            }`;

            const response = await axios.post(
                this.API_URL,
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expert at configuring NanoFlow/n8n nodes. 
                            Suggest realistic, best-practice values for node properties based on the node type and its place in the workflow.`
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

            const content = response.data.choices[0]?.message?.content;
            if (!content) {
                return { config: node.config || {}, explanation: "Empty AI response" };
            }
            return safeJsonParse(content, { config: node.config || {}, explanation: "Failed to parse AI response" });
        } catch (error) {
            console.error('Error suggesting config with AI:', error);
            return {
                config: node.config || {},
                explanation: "Failed to generate suggestions."
            };
        }
    }

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

            const content = response.data.choices[0]?.message?.content;
            if (!content) {
                return this.getMockResponse(prompt);
            }
            return safeJsonParse(content, this.getMockResponse(prompt));
        } catch (error) {
            console.error('Error generating workflow with AI:', error);
            return this.getMockResponse(prompt);
        }
    }

    static async debugWorkflow(
        question: string,
        context: DebugContext,
        language: string = 'en'
    ): Promise<DebugAnalysis> {
        if (!this.API_KEY) {
            return this.getMockDebugResponse(question, context, language);
        }

        try {
            const failedNodes = context.nodeLogs?.filter(log => log.status === 'FAILED') || [];
            const errorMessages = failedNodes.map(n => `${n.nodeName} (${n.nodeType}): ${n.error}`).join('\n');

            const prompt = `You are an expert workflow debugger for NanoFlow (similar to n8n).

User Question: "${question}"

Workflow Context:
- Workflow ID: ${context.workflowId}
- Execution ID: ${context.executionId || 'N/A'}
- Total Nodes: ${context.nodes.length}
- Execution Error: ${context.executionError || 'None'}

Failed Nodes:
${errorMessages || 'No failures recorded'}

Node Logs Summary:
${JSON.stringify(context.nodeLogs?.slice(-10) || [], null, 2)}

Workflow Structure:
${JSON.stringify(context.nodes.map(n => ({ id: n.id, type: n.type, title: n.title })), null, 2)}

Analyze the issue and provide debugging assistance.
Respond in ${language === 'es' ? 'Spanish' : 'English'}.

Return ONLY a JSON object with:
{
    "summary": "Brief summary of what went wrong",
    "rootCause": "The most likely root cause",
    "affectedNodes": ["node-id-1", "node-id-2"],
    "suggestedFixes": [
        {
            "nodeId": "node-id",
            "action": "fix_config | add_retry | change_input | etc",
            "description": "What to do",
            "code": "optional code snippet if relevant"
        }
    ],
    "relatedDocs": ["optional documentation links"],
    "confidence": "high | medium | low"
}`;

            const response = await axios.post(
                this.API_URL,
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expert workflow debugger for NanoFlow/n8n automation platform.
                            Your job is to analyze workflow execution errors and provide actionable debugging assistance.
                            Be specific, concise, and focus on practical solutions.`
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
            console.error('Error debugging workflow with AI:', error);
            return this.getMockDebugResponse(question, context, language);
        }
    }

    static async askAboutNode(
        question: string,
        node: WorkflowNode,
        nodeLog?: {
            status: string;
            input?: unknown;
            output?: unknown;
            error?: string;
        },
        language: string = 'en'
    ): Promise<{ answer: string; suggestions: string[] }> {
        if (!this.API_KEY) {
            return {
                answer: language === 'es' 
                    ? 'Servicio AI no configurado. Configure OPENAI_API_KEY.' 
                    : 'AI service not configured. Set OPENAI_API_KEY.',
                suggestions: []
            };
        }

        try {
            const prompt = `User question about a workflow node: "${question}"

Node Details:
- Type: ${node.type}
- Title: ${node.title}
- Config: ${JSON.stringify(node.config || {})}

Execution Log:
- Status: ${nodeLog?.status || 'N/A'}
- Input: ${JSON.stringify(nodeLog?.input || {})}
- Output: ${JSON.stringify(nodeLog?.output || {})}
- Error: ${nodeLog?.error || 'None'}

Provide a helpful answer about this specific node.
Respond in ${language === 'es' ? 'Spanish' : 'English'}.

Return ONLY a JSON object with:
{
    "answer": "Your detailed answer here",
    "suggestions": ["suggestion 1", "suggestion 2"]
}`;

            const response = await axios.post(
                this.API_URL,
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert at NanoFlow/n8n workflow nodes. Help users understand node behavior and debug issues.'
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
            console.error('Error asking about node with AI:', error);
            return {
                answer: language === 'es' 
                    ? 'Error al procesar la consulta.' 
                    : 'Failed to process the query.',
                suggestions: []
            };
        }
    }

    static async explainError(
        errorMessage: string,
        context: {
            nodeType?: string;
            nodeTitle?: string;
            nodeConfig?: Record<string, any>;
            input?: unknown;
            stackTrace?: string;
        },
        language: string = 'en'
    ): Promise<{
        explanation: string;
        possibleCauses: string[];
        suggestedFixes: Array<{
            title: string;
            description: string;
            code?: string;
            priority: 'high' | 'medium' | 'low';
        }>;
        relatedErrors: string[];
        documentation?: string;
    }> {
        const errorPatterns = this.analyzeErrorPattern(errorMessage);

        if (!this.API_KEY) {
            return this.getMockErrorExplanation(errorMessage, errorPatterns, language);
        }

        try {
            const prompt = `You are an expert at debugging NanoFlow/n8n workflow errors.

Error Message: "${errorMessage}"

Context:
- Node Type: ${context.nodeType || 'Unknown'}
- Node Title: ${context.nodeTitle || 'Unknown'}
- Node Config: ${JSON.stringify(context.nodeConfig || {})}
- Input Data: ${JSON.stringify(context.input || {})}
- Stack Trace: ${context.stackTrace || 'Not available'}

Analyze this error and provide:
1. A clear, non-technical explanation of what went wrong
2. Possible causes
3. Step-by-step fixes with code examples where relevant
4. Related common errors

Respond in ${language === 'es' ? 'Spanish' : 'English'}.

Return ONLY a JSON object with:
{
    "explanation": "Clear explanation of the error in simple terms",
    "possibleCauses": ["cause 1", "cause 2", ...],
    "suggestedFixes": [
        {
            "title": "Fix title",
            "description": "Detailed description of how to fix",
            "code": "optional code example",
            "priority": "high | medium | low"
        }
    ],
    "relatedErrors": ["similar error 1", "similar error 2"],
    "documentation": "optional link to relevant docs"
}`;

            const response = await axios.post(
                this.API_URL,
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expert at debugging automation workflow errors.
                            Your goal is to explain errors in simple, actionable terms that help users fix issues quickly.
                            Always provide practical, step-by-step solutions.`
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
            console.error('Error explaining error with AI:', error);
            return this.getMockErrorExplanation(errorMessage, errorPatterns, language);
        }
    }

    static async suggestNextNode(
        nodes: WorkflowNode[],
        connections: WorkflowConnection[],
        lastNodeId?: string,
        language: string = 'en'
    ): Promise<AISuggestion[]> {
        if (!this.API_KEY) return this.getMockSuggestions(lastNodeId, language);

        try {
            const prompt = `Based on the current workflow structure, suggest the next 3 logical nodes to add.
            
            Current Nodes: ${JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type, title: n.title })))}
            Current Connections: ${JSON.stringify(connections)}
            Last Node Added/Selected: ${lastNodeId || 'None'}
            
            Respond in ${language === 'es' ? 'Spanish' : 'English'}.
            
            Return ONLY a JSON object with:
            {
                "suggestions": [
                    {
                        "nodeType": "full.node.type",
                        "reason": "Why this node makes sense here",
                        "configPreview": { "key": "value" }
                    }
                ]
            }`;

            const response = await axios.post(
                this.API_URL,
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert NanoFlow workflow designer. You help users by suggesting the next logical steps in their automation.'
                        },
                        { role: 'user', content: prompt }
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
            return result.suggestions;
        } catch (error) {
            console.error('Error suggesting next node:', error);
            return this.getMockSuggestions(lastNodeId, language);
        }
    }

    static async generateDocumentation(
        nodes: WorkflowNode[],
        connections: WorkflowConnection[],
        language: string = 'en'
    ): Promise<WorkflowDocumentation> {
        if (!this.API_KEY) return this.getMockDocumentation(nodes, language);

        try {
            const prompt = `Generate technical and functional documentation for this workflow.
            
            Workflow Structure:
            Nodes: ${JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type, title: n.title, config: n.config })))}
            Connections: ${JSON.stringify(connections)}
            
            Respond in ${language === 'es' ? 'Spanish' : 'English'}.
            
            Return ONLY a JSON object with:
            {
                "summary": "High-level overview",
                "useCases": ["use case 1", "use case 2"],
                "prerequisites": ["needed credentials", "external setups"],
                "nodesDescription": [{ "nodeId": "id", "description": "detailed role of this node" }],
                "dataFlow": "Explanation of how data transforms through the flow"
            }`;

            const response = await axios.post(
                this.API_URL,
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a technical writer specializing in automation workflows. Create clear, professional documentation.'
                        },
                        { role: 'user', content: prompt }
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
            console.error('Error generating documentation:', error);
            return this.getMockDocumentation(nodes, language);
        }
    }

    static async predictPotentialFailures(
        nodes: WorkflowNode[],
        connections: WorkflowConnection[],
        language: string = 'en'
    ): Promise<FailurePrediction[]> {
        if (!this.API_KEY) return [];

        try {
            const prompt = `Analyze this workflow and predict potential failure points (edge cases, missing validations, common API errors).
            
            Workflow:
            Nodes: ${JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type, title: n.title, config: n.config })))}
            Connections: ${JSON.stringify(connections)}
            
            Respond in ${language === 'es' ? 'Spanish' : 'English'}.
            
            Return ONLY a JSON object with:
            {
                "predictions": [
                    {
                        "nodeId": "id",
                        "riskLevel": "high | medium | low",
                        "potentialIssue": "description of what might go wrong",
                        "recommendation": "how to prevent or handle this"
                    }
                ]
            }`;

            const response = await axios.post(
                this.API_URL,
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a QA engineer specialized in complex automation workflows. You excel at finding weak spots and missing error handling.'
                        },
                        { role: 'user', content: prompt }
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
            return result.predictions;
        } catch (error) {
            console.error('Error predicting failures:', error);
            return [];
        }
    }

    static async suggestOptimizations(
        nodes: WorkflowNode[],
        connections: WorkflowConnection[],
        language: string = 'en'
    ): Promise<WorkflowOptimization[]> {
        if (!this.API_KEY) return [];

        try {
            const prompt = `Suggest optimizations for this workflow in terms of performance, reliability, cost, and simplicity.
            
            Workflow:
            Nodes: ${JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type, title: n.title, config: n.config })))}
            Connections: ${JSON.stringify(connections)}
            
            Respond in ${language === 'es' ? 'Spanish' : 'English'}.
            
            Return ONLY a JSON object with:
            {
                "optimizations": [
                    {
                        "type": "performance | reliability | cost | simplicity",
                        "description": "what can be improved",
                        "impact": "estimated benefit",
                        "actionableFix": "step-by-step or code snippet"
                    }
                ]
            }`;

            const response = await axios.post(
                this.API_URL,
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a Senior Solutions Architect. You optimize workflows for production readiness, focusing on efficiency and maintainability.'
                        },
                        { role: 'user', content: prompt }
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
            return result.optimizations;
        } catch (error) {
            console.error('Error suggesting optimizations:', error);
            return [];
        }
    }

    private static analyzeErrorPattern(errorMessage: string): {
        type: string;
        category: string;
        keywords: string[];
    } {
        const lowerError = errorMessage.toLowerCase();
        
        if (lowerError.includes('econnrefused') || lowerError.includes('network') || lowerError.includes('timeout')) {
            return { type: 'network', category: 'connectivity', keywords: ['connection', 'network', 'timeout'] };
        }
        if (lowerError.includes('401') || lowerError.includes('403') || lowerError.includes('unauthorized') || lowerError.includes('forbidden')) {
            return { type: 'auth', category: 'authentication', keywords: ['credentials', 'api key', 'token'] };
        }
        if (lowerError.includes('404') || lowerError.includes('not found')) {
            return { type: 'notfound', category: 'resource', keywords: ['url', 'endpoint', 'resource'] };
        }
        if (lowerError.includes('500') || lowerError.includes('internal server')) {
            return { type: 'server', category: 'external', keywords: ['server', 'api', 'service'] };
        }
        if (lowerError.includes('json') || lowerError.includes('parse') || lowerError.includes('syntax')) {
            return { type: 'parsing', category: 'data', keywords: ['json', 'format', 'syntax'] };
        }
        if (lowerError.includes('undefined') || lowerError.includes('null') || lowerError.includes('cannot read')) {
            return { type: 'nullref', category: 'data', keywords: ['null', 'undefined', 'missing'] };
        }
        if (lowerError.includes('rate limit') || lowerError.includes('429') || lowerError.includes('too many')) {
            return { type: 'ratelimit', category: 'throttling', keywords: ['rate limit', 'throttle', 'quota'] };
        }
        
        return { type: 'unknown', category: 'general', keywords: [] };
    }

    private static getMockErrorExplanation(
        errorMessage: string,
        pattern: { type: string; category: string; keywords: string[] },
        language: string
    ): {
        explanation: string;
        possibleCauses: string[];
        suggestedFixes: Array<{
            title: string;
            description: string;
            code?: string;
            priority: 'high' | 'medium' | 'low';
        }>;
        relatedErrors: string[];
        documentation?: string;
    } {
        const isEs = language === 'es';

        const explanations: Record<string, any> = {
            network: {
                explanation: isEs 
                    ? 'El nodo no pudo conectarse al servidor destino. Esto puede deberse a problemas de red, firewall, o el servidor está caído.'
                    : 'The node could not connect to the target server. This might be due to network issues, firewall, or the server being down.',
                possibleCauses: isEs
                    ? ['El servidor destino está caído o no responde', 'Problemas de firewall o red', 'URL incorrecta', 'Timeout muy corto']
                    : ['Target server is down or unresponsive', 'Firewall or network issues', 'Incorrect URL', 'Timeout too short'],
                suggestedFixes: [
                    {
                        title: isEs ? 'Verificar conectividad' : 'Check connectivity',
                        description: isEs 
                            ? 'Prueba acceder a la URL desde tu navegador o usando curl'
                            : 'Try accessing the URL from your browser or using curl',
                        priority: 'high' as const
                    },
                    {
                        title: isEs ? 'Aumentar timeout' : 'Increase timeout',
                        description: isEs
                            ? 'Incrementa el tiempo de espera del nodo a 30-60 segundos'
                            : 'Increase the node timeout to 30-60 seconds',
                        code: 'timeout: 60000',
                        priority: 'medium' as const
                    }
                ],
                relatedErrors: ['ETIMEDOUT', 'ENOTFOUND', 'socket hang up']
            },
            auth: {
                explanation: isEs
                    ? 'La autenticación falló. Las credenciales proporcionadas no son válidas o han expirado.'
                    : 'Authentication failed. The provided credentials are invalid or have expired.',
                possibleCauses: isEs
                    ? ['API key inválida o expirada', 'Token de acceso expirado', 'Permisos insuficientes', 'Credenciales incorrectas']
                    : ['Invalid or expired API key', 'Expired access token', 'Insufficient permissions', 'Incorrect credentials'],
                suggestedFixes: [
                    {
                        title: isEs ? 'Verificar credenciales' : 'Verify credentials',
                        description: isEs
                            ? 'Revisa que la API key o token sean correctos y no hayan expirado'
                            : 'Check that the API key or token is correct and has not expired',
                        priority: 'high' as const
                    },
                    {
                        title: isEs ? 'Regenerar token' : 'Regenerate token',
                        description: isEs
                            ? 'Genera un nuevo token de acceso desde la consola del servicio'
                            : 'Generate a new access token from the service console',
                        priority: 'high' as const
                    }
                ],
                relatedErrors: ['Invalid token', 'Access denied', 'Permission denied']
            },
            notfound: {
                explanation: isEs
                    ? 'El recurso solicitado no existe. La URL o endpoint puede estar mal escrito o el recurso fue eliminado.'
                    : 'The requested resource does not exist. The URL or endpoint might be misspelled or the resource was deleted.',
                possibleCauses: isEs
                    ? ['URL incorrecta', 'El recurso fue eliminado', 'Endpoint deprecado', 'ID de recurso incorrecto']
                    : ['Incorrect URL', 'Resource was deleted', 'Deprecated endpoint', 'Wrong resource ID'],
                suggestedFixes: [
                    {
                        title: isEs ? 'Verificar URL' : 'Verify URL',
                        description: isEs
                            ? 'Revisa que la URL del endpoint sea correcta consultando la documentación del API'
                            : 'Check that the endpoint URL is correct by consulting the API documentation',
                        priority: 'high' as const
                    }
                ],
                relatedErrors: ['Resource not found', 'Endpoint not found', 'Invalid path']
            },
            ratelimit: {
                explanation: isEs
                    ? 'Se excedió el límite de solicitudes del API. Necesitas esperar o reducir la frecuencia de llamadas.'
                    : 'API rate limit exceeded. You need to wait or reduce the frequency of calls.',
                possibleCauses: isEs
                    ? ['Demasiadas solicitudes en poco tiempo', 'Plan del API con límites bajos', 'Otros workflows usando las mismas credenciales']
                    : ['Too many requests in a short time', 'API plan with low limits', 'Other workflows using the same credentials'],
                suggestedFixes: [
                    {
                        title: isEs ? 'Agregar nodo Wait' : 'Add Wait node',
                        description: isEs
                            ? 'Agrega pausas entre solicitudes para no exceder el límite'
                            : 'Add pauses between requests to avoid exceeding the limit',
                        code: '// Add a Wait node with 1-2 seconds delay',
                        priority: 'high' as const
                    },
                    {
                        title: isEs ? 'Implementar retry con backoff' : 'Implement retry with backoff',
                        description: isEs
                            ? 'Usa reintentos con espera exponencial'
                            : 'Use retries with exponential backoff',
                        priority: 'medium' as const
                    }
                ],
                relatedErrors: ['Quota exceeded', 'Too many requests', 'Throttled']
            },
            parsing: {
                explanation: isEs
                    ? 'Error al procesar los datos. El formato de los datos no es válido o no coincide con lo esperado.'
                    : 'Error processing data. The data format is invalid or does not match what was expected.',
                possibleCauses: isEs
                    ? ['JSON malformado', 'Respuesta vacía o inesperada', 'Codificación de caracteres incorrecta']
                    : ['Malformed JSON', 'Empty or unexpected response', 'Incorrect character encoding'],
                suggestedFixes: [
                    {
                        title: isEs ? 'Validar formato de datos' : 'Validate data format',
                        description: isEs
                            ? 'Verifica que los datos de entrada tengan el formato JSON correcto'
                            : 'Verify that input data has the correct JSON format',
                        priority: 'high' as const
                    }
                ],
                relatedErrors: ['Unexpected token', 'Invalid JSON', 'Syntax error']
            },
            nullref: {
                explanation: isEs
                    ? 'Se intentó acceder a un valor que no existe. Un campo esperado está vacío o no fue proporcionado.'
                    : 'Attempted to access a value that does not exist. An expected field is empty or was not provided.',
                possibleCauses: isEs
                    ? ['Campo faltante en los datos de entrada', 'Nodo anterior no produjo output', 'Referencia a variable inexistente']
                    : ['Missing field in input data', 'Previous node did not produce output', 'Reference to non-existent variable'],
                suggestedFixes: [
                    {
                        title: isEs ? 'Agregar validación de datos' : 'Add data validation',
                        description: isEs
                            ? 'Verifica que los campos existan antes de usarlos'
                            : 'Check that fields exist before using them',
                        code: 'if (data?.field) { /* use field */ }',
                        priority: 'high' as const
                    }
                ],
                relatedErrors: ['Cannot read property', 'is undefined', 'is null']
            }
        };

        return explanations[pattern.type] || {
            explanation: isEs
                ? `Error: ${errorMessage}. Revisa la configuración del nodo y los datos de entrada.`
                : `Error: ${errorMessage}. Review the node configuration and input data.`,
            possibleCauses: isEs
                ? ['Configuración incorrecta', 'Datos de entrada inválidos', 'Error en el servicio externo']
                : ['Incorrect configuration', 'Invalid input data', 'External service error'],
            suggestedFixes: [{
                title: isEs ? 'Revisar configuración' : 'Review configuration',
                description: isEs
                    ? 'Verifica que todos los campos requeridos estén correctamente configurados'
                    : 'Verify that all required fields are correctly configured',
                priority: 'medium' as const
            }],
            relatedErrors: []
        };
    }

    private static getMockSuggestions(lastNodeId?: string, language: string = 'en'): AISuggestion[] {
        const isEs = language === 'es';
        return [
            {
                nodeType: 'n8n-nodes-base.httpRequest',
                reason: isEs ? 'Para obtener datos de un API externa' : 'To fetch data from an external API',
                configPreview: { method: 'GET', url: 'https://api.example.com/data' }
            },
            {
                nodeType: 'n8n-nodes-base.if',
                reason: isEs ? 'Para agregar lógica condicional basada en los resultados' : 'To add conditional logic based on results',
                configPreview: { conditions: { string: [{ value1: '={{ $json.status }}', value2: 'success' }] } }
            },
            {
                nodeType: 'n8n-nodes-base.code',
                reason: isEs ? 'Para transformar los datos usando JavaScript' : 'To transform data using JavaScript',
                configPreview: { jsCode: 'return input.data.map(item => ({ ...item, processed: true }));' }
            }
        ];
    }

    private static getMockDocumentation(nodes: WorkflowNode[], language: string = 'en'): WorkflowDocumentation {
        const isEs = language === 'es';
        return {
            summary: isEs ? 'Este workflow automatiza procesos basados en disparadores manuales o programados.' : 'This workflow automates processes based on manual or scheduled triggers.',
            useCases: [
                isEs ? 'Sincronización de datos entre sistemas' : 'Data synchronization between systems',
                isEs ? 'Notificaciones automáticas' : 'Automated notifications'
            ],
            prerequisites: [
                isEs ? 'API Keys para los servicios externos' : 'API Keys for external services',
                isEs ? 'Configuración de red para webhooks' : 'Network configuration for webhooks'
            ],
            nodesDescription: nodes.map(n => ({
                nodeId: n.id,
                description: isEs ? `Procesa lógica de tipo ${n.type}` : `Processes logic of type ${n.type}`
            })),
            dataFlow: isEs 
                ? 'Los datos fluyen secuencialmente a través de los nodos, transformándose en cada paso.' 
                : 'Data flows sequentially through nodes, transforming at each step.'
        };
    }

    private static getMockDebugResponse(
        question: string,
        context: DebugContext,
        language: string
    ): DebugAnalysis {
        const failedNodes = context.nodeLogs?.filter(log => log.status === 'FAILED') || [];
        
        if (failedNodes.length === 0) {
            return {
                summary: language === 'es' 
                    ? 'No se encontraron errores en la ejecución.' 
                    : 'No errors found in the execution.',
                rootCause: language === 'es' 
                    ? 'El workflow se ejecutó correctamente.' 
                    : 'The workflow executed successfully.',
                affectedNodes: [],
                suggestedFixes: [],
                confidence: 'high'
            };
        }

        const firstFailed = failedNodes[0];
        return {
            summary: language === 'es' 
                ? `El nodo "${firstFailed.nodeName}" falló durante la ejecución.` 
                : `Node "${firstFailed.nodeName}" failed during execution.`,
            rootCause: firstFailed.error || (language === 'es' ? 'Error desconocido' : 'Unknown error'),
            affectedNodes: failedNodes.map(n => n.nodeId),
            suggestedFixes: [{
                nodeId: firstFailed.nodeId,
                action: 'review_config',
                description: language === 'es' 
                    ? 'Revise la configuración del nodo y los datos de entrada.' 
                    : 'Review the node configuration and input data.'
            }],
            confidence: 'medium'
        };
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
