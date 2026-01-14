/**
 * Servicio de integración con n8n usando la API REST
 * Permite ejecutar workflows y nodos de n8n desde NanoFlow
 */

import axios, { AxiosInstance } from 'axios';

interface N8nWorkflow {
  id?: string;
  name: string;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  active?: boolean;
  settings?: Record<string, unknown>;
}

interface N8nNode {
  id?: string;
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}

interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  status: string;
  data?: {
    resultData?: {
      runData?: Record<string, unknown>;
    };
  };
}

interface N8nCredential {
  id?: string;
  name: string;
  type: string;
  data: Record<string, unknown>;
}

interface N8nVariable {
  id?: string;
  key: string;
  value: string;
}

interface N8nTag {
  id?: string;
  name: string;
}

class N8nService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
    const apiKey = process.env.N8N_API_KEY;

    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-N8N-API-KEY': apiKey }),
      },
      timeout: 30000,
    });
  }

  // ==================== Health Check ====================

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/workflows', { params: { limit: 1 } });
      return response.status === 200;
    } catch (error) {
      console.error('n8n health check failed:', error);
      return false;
    }
  }

  // ==================== Workflows ====================

  async getWorkflows(): Promise<N8nWorkflow[]> {
    try {
      const response = await this.client.get('/workflows');
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching n8n workflows:', error);
      throw error;
    }
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response = await this.client.get(`/workflows/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching workflow ${id}:`, error);
      throw error;
    }
  }

  async createWorkflow(workflow: N8nWorkflow): Promise<N8nWorkflow> {
    try {
      const response = await this.client.post('/workflows', workflow);
      return response.data;
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  }

  async updateWorkflow(id: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    try {
      const response = await this.client.patch(`/workflows/${id}`, workflow);
      return response.data;
    } catch (error) {
      console.error(`Error updating workflow ${id}:`, error);
      throw error;
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    try {
      await this.client.delete(`/workflows/${id}`);
    } catch (error) {
      console.error(`Error deleting workflow ${id}:`, error);
      throw error;
    }
  }

  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response = await this.client.post(`/workflows/${id}/activate`);
      return response.data;
    } catch (error) {
      console.error(`Error activating workflow ${id}:`, error);
      throw error;
    }
  }

  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response = await this.client.post(`/workflows/${id}/deactivate`);
      return response.data;
    } catch (error) {
      console.error(`Error deactivating workflow ${id}:`, error);
      throw error;
    }
  }

  // ==================== Executions ====================

  async executeWorkflow(id: string, data?: Record<string, unknown>): Promise<N8nExecution> {
    try {
      const response = await this.client.post(`/workflows/${id}/run`, { data });
      return response.data;
    } catch (error) {
      console.error(`Error executing workflow ${id}:`, error);
      throw error;
    }
  }

  async getExecutions(workflowId?: string): Promise<N8nExecution[]> {
    try {
      const params = workflowId ? { workflowId } : {};
      const response = await this.client.get('/executions', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching executions:', error);
      throw error;
    }
  }

  async getExecution(id: string): Promise<N8nExecution> {
    try {
      const response = await this.client.get(`/executions/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching execution ${id}:`, error);
      throw error;
    }
  }

  async deleteExecution(id: string): Promise<void> {
    try {
      await this.client.delete(`/executions/${id}`);
    } catch (error) {
      console.error(`Error deleting execution ${id}:`, error);
      throw error;
    }
  }

  // ==================== Credentials ====================

  async getCredentials(): Promise<N8nCredential[]> {
    try {
      const response = await this.client.get('/credentials');
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching credentials:', error);
      throw error;
    }
  }

  async createCredential(credential: N8nCredential): Promise<N8nCredential> {
    try {
      const response = await this.client.post('/credentials', credential);
      return response.data;
    } catch (error) {
      console.error('Error creating credential:', error);
      throw error;
    }
  }

  async deleteCredential(id: string): Promise<void> {
    try {
      await this.client.delete(`/credentials/${id}`);
    } catch (error) {
      console.error(`Error deleting credential ${id}:`, error);
      throw error;
    }
  }

  // ==================== Variables ====================

  async getVariables(): Promise<N8nVariable[]> {
    try {
      const response = await this.client.get('/variables');
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching variables:', error);
      throw error;
    }
  }

  async createVariable(variable: N8nVariable): Promise<N8nVariable> {
    try {
      const response = await this.client.post('/variables', variable);
      return response.data;
    } catch (error) {
      console.error('Error creating variable:', error);
      throw error;
    }
  }

  async deleteVariable(id: string): Promise<void> {
    try {
      await this.client.delete(`/variables/${id}`);
    } catch (error) {
      console.error(`Error deleting variable ${id}:`, error);
      throw error;
    }
  }

  // ==================== Tags ====================

  async getTags(): Promise<N8nTag[]> {
    try {
      const response = await this.client.get('/tags');
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }
  }

  async createTag(tag: N8nTag): Promise<N8nTag> {
    try {
      const response = await this.client.post('/tags', tag);
      return response.data;
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  }

  async deleteTag(id: string): Promise<void> {
    try {
      await this.client.delete(`/tags/${id}`);
    } catch (error) {
      console.error(`Error deleting tag ${id}:`, error);
      throw error;
    }
  }

  // ==================== NanoFlow Integration ====================

  /**
   * Ejecuta un nodo n8n individual desde NanoFlow
   */
  async executeN8nNode(
    nodeType: string,
    parameters: Record<string, unknown>,
    inputData?: Record<string, unknown>
  ): Promise<unknown> {
    // Crear un workflow temporal con un solo nodo
    const tempWorkflow: N8nWorkflow = {
      name: `NanoFlow_Temp_${Date.now()}`,
      nodes: [
        {
          name: 'Start',
          type: 'n8n-nodes-base.start',
          position: [250, 300],
          parameters: {},
        },
        {
          name: 'ExecuteNode',
          type: nodeType,
          position: [450, 300],
          parameters,
        },
      ],
      connections: {
        Start: {
          main: [
            [
              {
                node: 'ExecuteNode',
                type: 'main',
                index: 0,
              },
            ],
          ],
        },
      },
      settings: {
        saveExecutionProgress: false,
        saveManualExecutions: false,
      },
    };

    try {
      // Crear workflow temporal
      const createdWorkflow = await this.createWorkflow(tempWorkflow);

      if (!createdWorkflow.id) {
        throw new Error('No se pudo crear el workflow temporal');
      }

      // Ejecutar el workflow
      const execution = await this.executeWorkflow(createdWorkflow.id, inputData);

      // Esperar a que termine la ejecución
      let finalExecution = execution;
      let attempts = 0;
      const maxAttempts = 30;

      while (!finalExecution.finished && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        finalExecution = await this.getExecution(execution.id);
        attempts++;
      }

      // Eliminar el workflow temporal
      await this.deleteWorkflow(createdWorkflow.id);

      // Extraer el resultado del nodo
      const runData = finalExecution.data?.resultData?.runData;
      if (runData && runData['ExecuteNode']) {
        return runData['ExecuteNode'];
      }

      return finalExecution;
    } catch (error) {
      console.error('Error executing n8n node:', error);
      throw error;
    }
  }

  /**
   * Obtiene los tipos de nodos disponibles en n8n
   */
  async getAvailableNodeTypes(): Promise<string[]> {
    // Lista de nodos comunes de n8n
    return [
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.code',
      'n8n-nodes-base.if',
      'n8n-nodes-base.switch',
      'n8n-nodes-base.merge',
      'n8n-nodes-base.set',
      'n8n-nodes-base.function',
      'n8n-nodes-base.postgres',
      'n8n-nodes-base.mysql',
      'n8n-nodes-base.mongodb',
      'n8n-nodes-base.redis',
      'n8n-nodes-base.slack',
      'n8n-nodes-base.discord',
      'n8n-nodes-base.telegram',
      'n8n-nodes-base.gmail',
      'n8n-nodes-base.googleSheets',
      'n8n-nodes-base.openAi',
      'n8n-nodes-base.anthropic',
    ];
  }

  /**
   * Convierte un nodo de NanoFlow a formato n8n
   */
  convertNanoFlowNodeToN8n(
    nanoflowNode: { type: string; data: Record<string, unknown>; position: { x: number; y: number } }
  ): N8nNode {
    const typeMapping: Record<string, string> = {
      'n8n-webhook': 'n8n-nodes-base.webhook',
      'n8n-http': 'n8n-nodes-base.httpRequest',
      'n8n-code': 'n8n-nodes-base.code',
      'n8n-if': 'n8n-nodes-base.if',
      'n8n-switch': 'n8n-nodes-base.switch',
      'n8n-merge': 'n8n-nodes-base.merge',
      'n8n-set': 'n8n-nodes-base.set',
      'n8n-function': 'n8n-nodes-base.function',
    };

    return {
      name: (nanoflowNode.data.label as string) || 'Node',
      type: typeMapping[nanoflowNode.type] || nanoflowNode.type,
      position: [nanoflowNode.position.x, nanoflowNode.position.y],
      parameters: nanoflowNode.data.parameters as Record<string, unknown> || {},
    };
  }
}

export const n8nService = new N8nService();
export default n8nService;
