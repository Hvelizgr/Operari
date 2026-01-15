/**
 * Servicio de integración con n8n usando la API REST
 * Permite ejecutar workflows y nodos de n8n desde NanoFlow
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger.config';

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
      logger.warn({ err: error }, 'n8n health check failed');
      return false;
    }
  }

  // ==================== Workflows ====================

  async getWorkflows(): Promise<N8nWorkflow[]> {
    try {
      const response = await this.client.get('/workflows');
      return response.data.data || [];
    } catch (error) {
      logger.error({ err: error }, 'Error fetching n8n workflows');
      throw error;
    }
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response = await this.client.get(`/workflows/${id}`);
      return response.data;
    } catch (error) {
      logger.error({ err: error, workflowId: id }, 'Error fetching workflow');
      throw error;
    }
  }

  async createWorkflow(workflow: N8nWorkflow): Promise<N8nWorkflow> {
    try {
      const response = await this.client.post('/workflows', workflow);
      return response.data;
    } catch (error) {
      logger.error({ err: error }, 'Error creating workflow');
      throw error;
    }
  }

  async updateWorkflow(id: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    try {
      const response = await this.client.patch(`/workflows/${id}`, workflow);
      return response.data;
    } catch (error) {
      logger.error({ err: error, workflowId: id }, 'Error updating workflow');
      throw error;
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    try {
      await this.client.delete(`/workflows/${id}`);
    } catch (error) {
      logger.error({ err: error, workflowId: id }, 'Error deleting workflow');
      throw error;
    }
  }

  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response = await this.client.post(`/workflows/${id}/activate`);
      return response.data;
    } catch (error) {
      logger.error({ err: error, workflowId: id }, 'Error activating workflow');
      throw error;
    }
  }

  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    try {
      const response = await this.client.post(`/workflows/${id}/deactivate`);
      return response.data;
    } catch (error) {
      logger.error({ err: error, workflowId: id }, 'Error deactivating workflow');
      throw error;
    }
  }

  // ==================== Executions ====================

  async executeWorkflow(id: string, data?: Record<string, unknown>): Promise<N8nExecution> {
    try {
      const response = await this.client.post(`/workflows/${id}/run`, { data });
      return response.data;
    } catch (error) {
      logger.error({ err: error, workflowId: id }, 'Error executing workflow');
      throw error;
    }
  }

  async getExecutions(workflowId?: string): Promise<N8nExecution[]> {
    try {
      const params = workflowId ? { workflowId } : {};
      const response = await this.client.get('/executions', { params });
      return response.data.data || [];
    } catch (error) {
      logger.error({ err: error }, 'Error fetching executions');
      throw error;
    }
  }

  async getExecution(id: string): Promise<N8nExecution> {
    try {
      const response = await this.client.get(`/executions/${id}`);
      return response.data;
    } catch (error) {
      logger.error({ err: error, executionId: id }, 'Error fetching execution');
      throw error;
    }
  }

  async deleteExecution(id: string): Promise<void> {
    try {
      await this.client.delete(`/executions/${id}`);
    } catch (error) {
      logger.error({ err: error, executionId: id }, 'Error deleting execution');
      throw error;
    }
  }

  // ==================== Credentials ====================

  async getCredentials(): Promise<N8nCredential[]> {
    try {
      const response = await this.client.get('/credentials');
      return response.data.data || [];
    } catch (error) {
      logger.error({ err: error }, 'Error fetching credentials');
      throw error;
    }
  }

  async createCredential(credential: N8nCredential): Promise<N8nCredential> {
    try {
      const response = await this.client.post('/credentials', credential);
      return response.data;
    } catch (error) {
      logger.error({ err: error }, 'Error creating credential');
      throw error;
    }
  }

  async deleteCredential(id: string): Promise<void> {
    try {
      await this.client.delete(`/credentials/${id}`);
    } catch (error) {
      logger.error({ err: error, credentialId: id }, 'Error deleting credential');
      throw error;
    }
  }

  // ==================== Variables ====================

  async getVariables(): Promise<N8nVariable[]> {
    try {
      const response = await this.client.get('/variables');
      return response.data.data || [];
    } catch (error) {
      logger.error({ err: error }, 'Error fetching variables');
      throw error;
    }
  }

  async createVariable(variable: N8nVariable): Promise<N8nVariable> {
    try {
      const response = await this.client.post('/variables', variable);
      return response.data;
    } catch (error) {
      logger.error({ err: error }, 'Error creating variable');
      throw error;
    }
  }

  async deleteVariable(id: string): Promise<void> {
    try {
      await this.client.delete(`/variables/${id}`);
    } catch (error) {
      logger.error({ err: error, variableId: id }, 'Error deleting variable');
      throw error;
    }
  }

  // ==================== Tags ====================

  async getTags(): Promise<N8nTag[]> {
    try {
      const response = await this.client.get('/tags');
      return response.data.data || [];
    } catch (error) {
      logger.error({ err: error }, 'Error fetching tags');
      throw error;
    }
  }

  async createTag(tag: N8nTag): Promise<N8nTag> {
    try {
      const response = await this.client.post('/tags', tag);
      return response.data;
    } catch (error) {
      logger.error({ err: error }, 'Error creating tag');
      throw error;
    }
  }

  async deleteTag(id: string): Promise<void> {
    try {
      await this.client.delete(`/tags/${id}`);
    } catch (error) {
      logger.error({ err: error, tagId: id }, 'Error deleting tag');
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
      logger.error({ err: error, nodeType }, 'Error executing n8n node');
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
