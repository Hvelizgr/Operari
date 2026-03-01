/**
 * Servicio de integración con n8n usando la API REST
 * Permite ejecutar workflows y nodos de n8n desde NanoFlow
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger.config';
import { Workflow } from '@prisma/client';
import { transformNanoFlowToN8n, transformN8nResultToNanoFlow } from './n8n-workflow-transformer';
import { WorkflowNode } from '../types/workflow.types';

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
  private iconMap: Map<string, string> = new Map();
  private sessionCookies: string = '';
  private lastLoginAttempt: number = 0;
  private loginCooldown: number = 60000; // 1 minute cooldown between login attempts

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

  /**
   * Login to n8n and get session cookies for internal API access
   */
  private async loginToN8n(): Promise<boolean> {
    const email = process.env.N8N_EMAIL;
    const password = process.env.N8N_PASSWORD;

    if (!email || !password) {
      console.warn('⚠️ N8N_EMAIL and N8N_PASSWORD not configured. Cannot login to n8n.');
      return false;
    }

    // Cooldown to prevent too many login attempts
    const now = Date.now();
    if (now - this.lastLoginAttempt < this.loginCooldown && this.sessionCookies) {
      return true; // Use existing session
    }
    this.lastLoginAttempt = now;

    try {
      console.log('🔐 Attempting login to n8n...');
      const response = await axios.post(
        `${this.baseUrl}/rest/login`,
        { emailOrLdapLoginId: email, password },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
          withCredentials: true,
        }
      );

      // Extract cookies from response headers
      const setCookieHeaders = response.headers['set-cookie'];
      if (setCookieHeaders && Array.isArray(setCookieHeaders)) {
        this.sessionCookies = setCookieHeaders
          .map((cookie: string) => cookie.split(';')[0])
          .join('; ');
        console.log('✅ Successfully logged into n8n');
        return true;
      }

      console.warn('⚠️ Login succeeded but no cookies received');
      return false;
    } catch (error: any) {
      console.error('❌ Failed to login to n8n:', error.response?.data?.message || error.message);
      this.sessionCookies = '';
      return false;
    }
  }

  // ==================== Health Check ====================

  async healthCheck(): Promise<boolean> {
    try {
      // Use raw axios to hit /healthz at root, bypassing /api/v1 and auth
      const response = await axios.get(`${this.baseUrl}/healthz`, { timeout: 2000 });
      return response.status === 200;
    } catch (error) {
      // Fallback: If healthz fails (older n8n), try the old method but catch 401 as "Alive but Unauthorized" (technically healthy)
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return true;
      }
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
   * Ejecuta un nodo n8n individual (wrapper simple para NodeExecutor)
   */
  async executeNode(
    nodeType: string,
    config: Record<string, unknown>,
    inputData?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeN8nNode(nodeType, config, inputData) as Promise<Record<string, unknown>>;
  }

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
        await new Promise(resolve => setTimeout(resolve, 1000));
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
   * Gets an icon file path for a specific node name by searching local filesystem
   * Supports multiple naming conventions (camelCase, PascalCase, lowercase)
   */
  getNodeIconPath(nodeName: string): string | null {
    // 1. Try exact match first
    if (this.iconMap.has(nodeName)) return this.iconMap.get(nodeName)!;

    // 2. Try lowercase variant
    const lowerName = nodeName.toLowerCase();
    if (this.iconMap.has(lowerName)) return this.iconMap.get(lowerName)!;

    // 3. Try common n8n naming variations
    // Some nodes are stored as "httpRequest" in cache but queried as "HttpRequest"
    const variations = [
      nodeName,
      lowerName,
      nodeName.replace(/([A-Z])/g, '_$1').toLowerCase(), // camelCase to snake_case
      nodeName.charAt(0).toLowerCase() + nodeName.slice(1), // first letter lowercase
    ];

    for (const key of this.iconMap.keys()) {
      for (const variation of variations) {
        if (key.toLowerCase() === variation.toLowerCase()) {
          return this.iconMap.get(key)!;
        }
      }
    }

    return null;
  }

  /**
   * Obtiene y adapta las definiciones de nodos directamente desde la instancia n8n.
   * Esto reemplaza la necesidad de tenerlos en la base de datos local.
   *
   * Estrategia:
   * 1. Intentar con sesión autenticada (login + cookies)
   * 2. Fallback a API key (si configurada)
   * 3. Fallback a caché local
   * 4. Fallback a escaneo de archivos
   */
  async getRemoteNodeDefinitions(): Promise<any[]> {
    const fs = require('fs');
    const path = require('path');
    const cacheFile = path.resolve(process.cwd(), 'data/cache/n8n-nodes.json');

    // 1. Intentar con sesión autenticada (login automático)
    try {
      const loggedIn = await this.loginToN8n();

      if (loggedIn && this.sessionCookies) {
        console.log(`🌐 Connecting to n8n API with session at ${this.baseUrl}/types/nodes.json...`);
        const response = await axios.get(`${this.baseUrl}/types/nodes.json`, {
          headers: {
            'Cookie': this.sessionCookies,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        });

        const nodesParams = response.data;

        if (Array.isArray(nodesParams) && nodesParams.length > 0) {
          // Success! Save to cache
          try {
            const cacheDir = path.dirname(cacheFile);
            if (!fs.existsSync(cacheDir)) {
              fs.mkdirSync(cacheDir, { recursive: true });
            }
            fs.writeFileSync(cacheFile, JSON.stringify(nodesParams, null, 2));
            console.log(`💾 Cache Updated: Saved ${nodesParams.length} nodes with full properties to ${cacheFile}`);
          } catch (writeErr) {
            console.error('⚠️ Failed to write to cache:', writeErr);
          }

          return this.mapN8nNodesToNanoFlow(nodesParams);
        }
      }
    } catch (error: any) {
      console.error('⚠️ Session-based API failed:', error.message);
      this.sessionCookies = ''; // Clear invalid session
    }

    // 2. Fallback: Try with API key (for public endpoints)
    try {
      const apiKey = process.env.N8N_API_KEY;
      if (apiKey) {
        console.log(`🔑 Trying n8n API with API key...`);
        const response = await axios.get(`${this.baseUrl}/types/nodes.json`, {
          headers: { 'X-N8N-API-KEY': apiKey },
          timeout: 8000,
        });

        const nodesParams = response.data;
        if (Array.isArray(nodesParams) && nodesParams.length > 0) {
          try {
            const cacheDir = path.dirname(cacheFile);
            if (!fs.existsSync(cacheDir)) {
              fs.mkdirSync(cacheDir, { recursive: true });
            }
            fs.writeFileSync(cacheFile, JSON.stringify(nodesParams, null, 2));
            console.log(`💾 Cache Updated: Saved ${nodesParams.length} nodes to ${cacheFile}`);
          } catch (writeErr) {
            console.error('⚠️ Failed to write to cache:', writeErr);
          }
          return this.mapN8nNodesToNanoFlow(nodesParams);
        }
      }
    } catch (error: any) {
      console.error('⚠️ API key method also failed. Checking cache...');
    }

    // 2. Intentar Caché Local (JSON Completo)
    try {
      if (fs.existsSync(cacheFile)) {
        console.log(`📦 Reading from cache: ${cacheFile}`);
        const cachedContent = fs.readFileSync(cacheFile, 'utf-8');
        const cachedNodes = JSON.parse(cachedContent);
        if (Array.isArray(cachedNodes) && cachedNodes.length > 0) {
          console.log(`✅ Cache Hit: Loaded ${cachedNodes.length} nodes with full properties.`);
          return this.mapN8nNodesToNanoFlow(cachedNodes);
        }
      }
    } catch {
      console.error('⚠️ Cache file corrupt or unreadable.');
    }

    // 3. Fallback Final: Escaneo de Archivos (Sin propiedades para TS)
    console.warn(
      '🔻 All caches failed. Scanning local filesystem (Metadata only for .ts files)...'
    );
    try {
      const localNodes = this.readLocalFallbackNodes();
      if (localNodes.length > 0) {
        return this.mapN8nNodesToNanoFlow(localNodes);
      }
    } catch (localError) {
      console.error('🔴 Fatal: Filesystem scan failed:', localError);
    }

    return [];
  }

  // Helper para mapear (extraído para reusar)
  private mapN8nNodesToNanoFlow(nodesParams: any[]): any[] {
    return nodesParams
      .map((n8nNode: any) => {
        // 1. Base Categories from n8n (Convert to slug parts)
        let parts: string[] = [];
        if (n8nNode.codex && n8nNode.codex.categories && n8nNode.codex.categories.length > 0) {
          parts = n8nNode.codex.categories.map((c: string) =>
            c.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          );
        } else if (n8nNode.group && n8nNode.group.length > 0) {
          parts = n8nNode.group.map((g: string) => g.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        }

        if (parts.length === 0) parts = ['others'];

        // 2. Intelligent Vendor Grouping (Create explicit folders for popular stacks)
        const name = (n8nNode.displayName || n8nNode.name || '').toLowerCase();

        if (name.startsWith('google')) {
          // Ensure 'google' is root folder
          if (parts[0] !== 'google') parts = ['google', ...parts];
        } else if (name.startsWith('aws') || name.startsWith('amazon')) {
          if (parts[0] !== 'aws') parts = ['aws', ...parts];
        } else if (name.startsWith('microsoft') || name.startsWith('azure')) {
          if (parts[0] !== 'microsoft') parts = ['microsoft', ...parts];
        } else if (name.includes('slack')) parts = ['communication', 'slack'];
        else if (name.includes('discord')) parts = ['communication', 'discord'];
        else if (name.includes('telegram')) parts = ['communication', 'telegram'];
        else if (name.includes('postgres') || name.includes('mysql') || name.includes('mongo'))
          parts = ['data', 'database'];
        else if (name.includes('openai') || name.includes('gpt')) parts = ['ai', 'openai'];

        // 3. Mark Triggers visually
        const isTrigger = name.includes('trigger') || parts.includes('trigger');

        // Generate hierarchical ID (e.g., "google/analytics", "ai/openai/model")
        const categoryId = parts.join('/');

        // Icon URL - Proxy through our own backend to solve auth/cross-origin issues
        const iconUrl = `/api/n8n/node-icons/${n8nNode.name}`;

        const safeLabel = n8nNode.displayName || n8nNode.name || 'Unknown Node';

        // Avoid double prefix - n8nNode.name might already include 'n8n-nodes-base.'
        const nodeType = n8nNode.name?.startsWith('n8n-nodes-base.')
          ? n8nNode.name
          : `n8n-nodes-base.${n8nNode.name}`;

        return {
          type: nodeType,
          category: categoryId,
          icon: 'Box',
          iconUrl,
          color: isTrigger ? 'bg-green-500' : 'bg-blue-500',
          label: { en: safeLabel, es: safeLabel },
          description: { en: `Integration for ${safeLabel}`, es: '' },
          inputs: n8nNode.inputs || [],
          outputs: n8nNode.outputs || [],
          properties: n8nNode.properties || [],
        };
      })
      .sort((a: any, b: any) => (a.label?.en || '').localeCompare(b.label?.en || ''));
  }

  private readLocalFallbackNodes(): any[] {
    const fs = require('fs');
    const path = require('path');
    const nodes: any[] = [];
    const nodesBase = path.resolve(process.cwd(), '../others/n8n/packages/nodes-base/nodes');

    console.log(`📂 Scanning local nodes and icons in: ${nodesBase}`);

    if (!fs.existsSync(nodesBase)) {
      console.warn('Local n8n folder not found.');
      return [];
    }

    const tsRegex = {
      displayName: /displayName:\s*['"](.+?)['"]/,
      name: /name:\s*['"](.+?)['"]/,
      icon: /icon:\s*['"](.+?)['"]/,
      description: /description:\s*['"](.+?)['"]/,
      group: /group:\s*\[\s*(['"].+?['"])\s*\]/,
    };

    const scan = (dir: string): void => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (file.endsWith('.svg') || file.endsWith('.png')) {
          // Cache icons: typically nodeName.svg or similar
          const nodeNameGuess = file.split('.')[0].toLowerCase();
          // Cache all naming variations
          this.iconMap.set(nodeNameGuess, fullPath);
          const pascalCase = nodeNameGuess.charAt(0).toUpperCase() + nodeNameGuess.slice(1);
          this.iconMap.set(pascalCase, fullPath);
        } else if (file.endsWith('.node.json')) {
          try {
            const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            if (!content.name) content.name = file.replace('.node.json', '');
            nodes.push(content);

            // If JSON has an icon field, try to find it in same dir
            if (content.icon && content.icon.startsWith('file:')) {
              const iconName = content.icon.replace('file:', '');
              const iconPath = path.join(dir, iconName);
              if (fs.existsSync(iconPath)) {
                this.iconMap.set(content.name, iconPath);
              }
            }
          } catch { /* skip invalid JSON files */ }
        } else if (file.endsWith('.node.ts')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes('INodeType')) {
              const nameMatch = content.match(tsRegex.name);
              const displayNameMatch = content.match(tsRegex.displayName);

              if (nameMatch && displayNameMatch) {
                const name = nameMatch[1];
                const node: any = {
                  name,
                  displayName: displayNameMatch[1],
                  description: content.match(tsRegex.description)?.[1] || '',
                  icon: content.match(tsRegex.icon)?.[1] || 'fa:cube',
                  group: content.match(tsRegex.group)?.[1]?.replace(/['"]/g, '').split(',') || [],
                  properties: [],
                };
                nodes.push(node);

                // Try to find icon mentioned in TS
                if (node.icon && node.icon.startsWith('file:')) {
                  const iconName = node.icon.replace('file:', '');
                  const iconPath = path.join(dir, iconName);
                  if (fs.existsSync(iconPath)) {
                    this.iconMap.set(name, iconPath);
                  }
                }
              }
            }
          } catch { /* skip files that can't be parsed */ }
        }
      }
    };
    scan(nodesBase);

    const uniqueNodes = Array.from(new Map(nodes.map(item => [item.name, item])).values());
    console.log(`✅ Loaded ${uniqueNodes.length} nodes and cached ${this.iconMap.size} icons.`);
    return uniqueNodes;
  }

  /**
   * Convierte un nodo de NanoFlow a formato n8n
   */
  convertNanoFlowNodeToN8n(nanoflowNode: {
    type: string;
    data: Record<string, unknown>;
    position: { x: number; y: number };
  }): N8nNode {
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
      parameters: (nanoflowNode.data.parameters as Record<string, unknown>) || {},
    };
  }

  // ==================== Full Workflow Execution via n8n ====================

  /**
   * Ejecuta un workflow completo de NanoFlow en n8n
   * Este es el método principal que usa n8n como motor de ejecución
   */
  async executeNanoFlowWorkflow(
    workflow: Workflow,
    inputData?: Record<string, unknown>,
    options?: {
      waitForCompletion?: boolean;
      timeout?: number;
      deleteAfterExecution?: boolean;
    }
  ): Promise<{
    executionId: string;
    n8nWorkflowId: string;
    status: 'running' | 'success' | 'error' | 'waiting';
    result?: Record<string, unknown>;
    error?: string;
  }> {
    const {
      waitForCompletion = true,
      timeout = 60000,
      deleteAfterExecution = true,
    } = options || {};

    let n8nWorkflowId: string | undefined;

    try {
      const n8nWorkflow = transformNanoFlowToN8n(workflow);
      logger.info({ workflowName: workflow.name }, 'Transforming NanoFlow workflow to n8n format');

      const createdWorkflow = await this.createWorkflow(n8nWorkflow as any);
      n8nWorkflowId = createdWorkflow.id;

      if (!n8nWorkflowId) {
        throw new Error('Failed to create n8n workflow - no ID returned');
      }

      logger.info({ n8nWorkflowId, workflowName: workflow.name }, 'Created temporary n8n workflow');

      const execution = await this.executeWorkflow(n8nWorkflowId, inputData);
      logger.info({ executionId: execution.id, n8nWorkflowId }, 'Started n8n workflow execution');

      if (!waitForCompletion) {
        return {
          executionId: execution.id,
          n8nWorkflowId,
          status: 'running',
        };
      }

      const finalExecution = await this.waitForExecution(execution.id, timeout);

      const nodes = workflow.nodes as unknown as WorkflowNode[];
      const nodeIdToName = new Map<string, string>();
      nodes.forEach((node, index) => {
        const safeName = node.title.replace(/[^a-zA-Z0-9_]/g, '_') || `Node_${index}`;
        nodeIdToName.set(node.id, safeName);
      });

      const result = transformN8nResultToNanoFlow(finalExecution as any, nodeIdToName);

      if (deleteAfterExecution && n8nWorkflowId) {
        try {
          await this.deleteWorkflow(n8nWorkflowId);
          logger.info({ n8nWorkflowId }, 'Deleted temporary n8n workflow');
        } catch (deleteError) {
          logger.warn({ n8nWorkflowId, error: deleteError }, 'Failed to delete temporary workflow');
        }
      }

      const isSuccess = finalExecution.status === 'success' || finalExecution.finished;

      return {
        executionId: execution.id,
        n8nWorkflowId: n8nWorkflowId!,
        status: isSuccess ? 'success' : 'error',
        result: result as Record<string, unknown>,
        error: isSuccess ? undefined : 'Workflow execution failed',
      };
    } catch (error) {
      logger.error({ error, workflowId: workflow.id }, 'Error executing workflow via n8n');

      if (deleteAfterExecution && n8nWorkflowId) {
        try {
          await this.deleteWorkflow(n8nWorkflowId);
        } catch (deleteError) {
          logger.warn({ n8nWorkflowId, error: deleteError }, 'Failed to cleanup workflow after error');
        }
      }

      throw error;
    }
  }

  /**
   * Espera a que una ejecución de n8n termine
   */
  async waitForExecution(executionId: string, timeout: number = 60000): Promise<N8nExecution> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < timeout) {
      const execution = await this.getExecution(executionId);

      if (execution.finished || execution.status === 'success' || execution.status === 'error') {
        return execution;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Execution ${executionId} timed out after ${timeout}ms`);
  }

  /**
   * Obtiene el estado de una ejecución con detalles de cada nodo
   */
  async getExecutionDetails(executionId: string): Promise<{
    status: string;
    finished: boolean;
    nodeResults: Record<string, {
      status: 'success' | 'error' | 'running' | 'waiting';
      output?: unknown;
      error?: string;
      startedAt?: string;
      finishedAt?: string;
    }>;
    error?: string;
  }> {
    const execution = await this.getExecution(executionId);
    
    const nodeResults: Record<string, any> = {};
    const runData = execution.data?.resultData?.runData as Record<string, any> | undefined;

    if (runData) {
      for (const [nodeName, executions] of Object.entries(runData)) {
        const executionsArray = executions as any[];
        if (!Array.isArray(executionsArray) || executionsArray.length === 0) {
          continue;
        }
        const lastExecution = executionsArray[executionsArray.length - 1];

        nodeResults[nodeName] = {
          status: lastExecution?.error ? 'error' : 'success',
          output: lastExecution?.data?.main?.[0]?.map((item: any) => item.json),
          error: lastExecution?.error?.message,
          startedAt: lastExecution?.startTime,
          finishedAt: lastExecution?.executionTime
            ? new Date(new Date(lastExecution.startTime).getTime() + lastExecution.executionTime).toISOString()
            : undefined,
        };
      }
    }

    return {
      status: execution.status,
      finished: execution.finished,
      nodeResults,
      error: execution.status === 'error' ? 'Execution failed' : undefined,
    };
  }

  /**
   * Cancela una ejecución en progreso
   */
  async cancelExecution(executionId: string): Promise<void> {
    try {
      await this.client.post(`/executions/${executionId}/stop`);
      logger.info({ executionId }, 'Execution cancelled');
    } catch (error) {
      logger.error({ error, executionId }, 'Failed to cancel execution');
      throw error;
    }
  }

  /**
   * Verifica si n8n está disponible y configurado correctamente
   */
  async isN8nAvailable(): Promise<boolean> {
    try {
      const healthy = await this.healthCheck();
      if (!healthy) return false;

      await this.getWorkflows();
      return true;
    } catch (error) {
      logger.warn({ error }, 'n8n is not available or not configured correctly');
      return false;
    }
  }
}

export const n8nService = new N8nService();
export default n8nService;
