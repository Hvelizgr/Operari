import { N8nWorkflowFormat, N8nNodeFormat, N8nConnectionFormat } from './n8n-workflow-transformer';

export interface ZapierStep {
  id: string;
  type: string;
  title?: string;
  provider?: string;
  action?: string;
  params?: Record<string, any>;
}

export interface ZapierWorkflow {
  id: string;
  name: string;
  steps: ZapierStep[];
}

export interface MakeModule {
  id: number;
  module: string;
  mapper?: Record<string, any>;
  metadata?: Record<string, any>;
  next?: number[];
}

export interface MakeBlueprint {
  name: string;
  flow: MakeModule[];
}

export class IntegrationTransformerService {
  /**
   * Transforma un Zap de Zapier al formato de n8n compatible con NanoFlow
   */
  static transformZapierToN8n(zap: ZapierWorkflow): N8nWorkflowFormat {
    const nodes: N8nNodeFormat[] = [];
    const connections: N8nConnectionFormat = {};

    zap.steps.forEach((step, index) => {
      const nodeName = step.title || `Step_${index + 1}`;
      const nodeType = this.mapZapierTypeToN8n(step.provider, step.action);
      
      nodes.push({
        name: nodeName,
        type: nodeType,
        position: [index * 250, 100],
        parameters: step.params || {},
        typeVersion: 1,
      });

      // Zapier es lineal por defecto
      if (index > 0) {
        const prevNodeName = zap.steps[index - 1].title || `Step_${index}`;
        if (!connections[prevNodeName]) {
          connections[prevNodeName] = { main: [[]] };
        }
        connections[prevNodeName].main[0].push({
          node: nodeName,
          type: 'main',
          index: 0,
        });
      }
    });

    return {
      name: zap.name || 'Imported Zapier Workflow',
      nodes,
      connections,
    };
  }

  /**
   * Transforma un Blueprint de Make (Integromat) al formato de n8n compatible con NanoFlow
   */
  static transformMakeToN8n(blueprint: MakeBlueprint): N8nWorkflowFormat {
    const nodes: N8nNodeFormat[] = [];
    const connections: N8nConnectionFormat = {};
    const idToName = new Map<number, string>();

    // Primero mapeamos nombres para las conexiones
    blueprint.flow.forEach((module) => {
      const name = module.metadata?.expect?.title || `Module_${module.id}`;
      idToName.set(module.id, name);
    });

    blueprint.flow.forEach((module, index) => {
      const nodeName = idToName.get(module.id)!;
      const nodeType = this.mapMakeTypeToN8n(module.module);

      nodes.push({
        name: nodeName,
        type: nodeType,
        position: [index * 250, index * 50 + 100], // Layout básico
        parameters: module.mapper || {},
        typeVersion: 1,
      });

      if (module.next && module.next.length > 0) {
        if (!connections[nodeName]) {
          connections[nodeName] = { main: [[]] };
        }
        module.next.forEach((nextId) => {
          const nextName = idToName.get(nextId);
          if (nextName) {
            connections[nodeName].main[0].push({
              node: nextName,
              type: 'main',
              index: 0,
            });
          }
        });
      }
    });

    return {
      name: blueprint.name || 'Imported Make Scenario',
      nodes,
      connections,
    };
  }

  private static mapZapierTypeToN8n(provider?: string, action?: string): string {
    const key = `${provider}:${action}`.toLowerCase();
    const mapping: Record<string, string> = {
      'webhook:catch_hook': 'n8n-nodes-base.webhook',
      'scheduler:every_day': 'n8n-nodes-base.scheduleTrigger',
      'gmail:new_email': 'n8n-nodes-base.gmailTrigger',
      'gmail:send_email': 'n8n-nodes-base.gmail',
      'google_sheets:new_row': 'n8n-nodes-base.googleSheetsTrigger',
      'google_sheets:create_row': 'n8n-nodes-base.googleSheets',
      'slack:new_message': 'n8n-nodes-base.slackTrigger',
      'slack:send_message': 'n8n-nodes-base.slack',
      'http:request': 'n8n-nodes-base.httpRequest',
      'filter:filter': 'n8n-nodes-base.if',
      'code:run_code': 'n8n-nodes-base.code',
      'notion:create_page': 'n8n-nodes-base.notion',
      'trello:create_card': 'n8n-nodes-base.trello',
      'discord:send_channel_message': 'n8n-nodes-base.discord',
    };

    return mapping[key] || (provider ? `n8n-nodes-base.${provider.replace(/_/g, '')}` : 'n8n-nodes-base.noOp');
  }

  private static mapMakeTypeToN8n(makeModule: string): string {
    const [provider, action] = makeModule.split(':');
    const key = `${provider}:${action}`.toLowerCase();
    
    const mapping: Record<string, string> = {
      'gateway:webhook': 'n8n-nodes-base.webhook',
      'google-sheets:watch-rows': 'n8n-nodes-base.googleSheetsTrigger',
      'google-sheets:update-row': 'n8n-nodes-base.googleSheets',
      'http:make-a-request': 'n8n-nodes-base.httpRequest',
      'json:parse-json': 'n8n-nodes-base.set',
      'router:router': 'n8n-nodes-base.switch',
      'gmail:watch-emails': 'n8n-nodes-base.gmailTrigger',
      'gmail:send-email': 'n8n-nodes-base.gmail',
      'slack:create-message': 'n8n-nodes-base.slack',
      'notion:create-page': 'n8n-nodes-base.notion',
    };

    return mapping[key] || (provider ? `n8n-nodes-base.${provider.replace(/-/g, '')}` : 'n8n-nodes-base.noOp');
  }
}
