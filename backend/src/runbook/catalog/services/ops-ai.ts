import type { CatalogNode } from '../define';
import { f, r, service } from '../service';

export const OPS_AI_NODES: CatalogNode[] = [
  service({
    type: 'pagerduty',
    category: 'monitoring',
    icon: 'Siren',
    color: 'bg-green-700',
    label: ['PagerDuty', 'PagerDuty'],
    description: [
      'Incidents, notes, on-call schedules and services (REST API)',
      'Incidentes, notas, guardias y servicios (REST API)',
    ],
    auth: {
      kind: 'header',
      provider: 'pagerduty',
      header: 'Authorization',
      prefix: 'Token token=',
      label: 'REST API key',
    },
    base: 'https://api.pagerduty.com',
    headers: { Accept: 'application/vnd.pagerduty+json;version=2' },
    headersFrom: (t): Record<string, string> =>
      t.str('fromEmail') ? { From: t.str('fromEmail') } : {},
    operations: [
      {
        value: 'incident.list',
        label: ['List incidents', 'Listar incidentes'],
        method: 'GET',
        path: '/incidents',
        fields: [
          f('statuses', 'Status', {
            key: 'statuses[]',
            description: 'triggered, acknowledged or resolved',
          }),
          f('since', 'Since (ISO)'),
          f('limit', 'Limit', { type: 'number' }),
        ],
      },
      {
        value: 'incident.get',
        label: ['Get incident', 'Obtener incidente'],
        method: 'GET',
        path: '/incidents/{incidentId}',
        fields: [r('incidentId', 'Incident id')],
        extra: false,
      },
      {
        value: 'incident.create',
        label: ['Create incident', 'Crear incidente'],
        method: 'POST',
        path: '/incidents',
        fields: [
          r('fromEmail', 'Your PagerDuty email', { in: 'none' }),
          r('title', 'Title', { in: 'none' }),
          r('serviceId', 'Service id', { in: 'none' }),
          f('urgency', 'Urgency', { in: 'none', default: 'high' }),
          f('details', 'Details', { rows: 3, in: 'none' }),
        ],
        body: t => ({
          incident: {
            type: 'incident',
            title: t.str('title'),
            service: { id: t.str('serviceId'), type: 'service_reference' },
            urgency: t.str('urgency') || 'high',
            ...(t.str('details')
              ? { body: { type: 'incident_body', details: t.str('details') } }
              : {}),
          },
        }),
        extra: false,
      },
      {
        value: 'incident.status',
        label: ['Acknowledge or resolve', 'Reconocer o resolver'],
        method: 'PUT',
        path: '/incidents/{incidentId}',
        fields: [
          r('incidentId', 'Incident id'),
          r('fromEmail', 'Your PagerDuty email', { in: 'none' }),
          r('status', 'Status', {
            type: 'options',
            in: 'none',
            default: 'acknowledged',
            options: [
              { name: 'Acknowledged', value: 'acknowledged' },
              { name: 'Resolved', value: 'resolved' },
            ],
          }),
        ],
        body: t => ({ incident: { type: 'incident_reference', status: t.str('status') } }),
        extra: false,
      },
      {
        value: 'incident.note',
        label: ['Add note', 'Agregar nota'],
        method: 'POST',
        path: '/incidents/{incidentId}/notes',
        fields: [
          r('incidentId', 'Incident id'),
          r('fromEmail', 'Your PagerDuty email', { in: 'none' }),
          r('content', 'Note', { rows: 3, key: 'note.content' }),
        ],
      },
      {
        value: 'oncall.list',
        label: ['Who is on call', 'Quién está de guardia'],
        method: 'GET',
        path: '/oncalls',
        fields: [
          f('scheduleId', 'Schedule id', { key: 'schedule_ids[]' }),
          f('escalationPolicyId', 'Escalation policy id', { key: 'escalation_policy_ids[]' }),
        ],
      },
      {
        value: 'service.list',
        label: ['List services', 'Listar servicios'],
        method: 'GET',
        path: '/services',
        fields: [f('query', 'Query')],
      },
      {
        value: 'maintenance.create',
        label: ['Start maintenance window', 'Iniciar ventana de mantenimiento'],
        method: 'POST',
        path: '/maintenance_windows',
        fields: [
          r('fromEmail', 'Your PagerDuty email', { in: 'none' }),
          r('serviceId', 'Service id', { in: 'none' }),
          r('start_time', 'Start (ISO)', { in: 'none' }),
          r('end_time', 'End (ISO)', { in: 'none' }),
          f('description', 'Description', { in: 'none' }),
        ],
        body: t => ({
          maintenance_window: {
            type: 'maintenance_window',
            start_time: t.str('start_time'),
            end_time: t.str('end_time'),
            description: t.str('description'),
            services: [{ id: t.str('serviceId'), type: 'service_reference' }],
          },
        }),
        extra: false,
      },
    ],
  }),

  service({
    type: 'opsgenie',
    category: 'monitoring',
    icon: 'BellRing',
    color: 'bg-blue-600',
    label: ['Opsgenie', 'Opsgenie'],
    description: [
      'Alerts: create, acknowledge, close, note and list; who is on call',
      'Alertas: crear, reconocer, cerrar, anotar y listar; quién está de guardia',
    ],
    auth: {
      kind: 'header',
      provider: 'opsgenie',
      header: 'Authorization',
      prefix: 'GenieKey ',
      label: 'API key',
    },
    base: {
      field: f('region', 'Region', {
        type: 'options',
        default: 'us',
        options: [
          { name: 'US', value: 'us' },
          { name: 'EU', value: 'eu' },
        ],
      }),
      build: v => (v === 'eu' ? 'https://api.eu.opsgenie.com' : 'https://api.opsgenie.com'),
    },
    operations: [
      {
        value: 'alert.create',
        label: ['Create alert', 'Crear alerta'],
        method: 'POST',
        path: '/v2/alerts',
        fields: [
          r('message', 'Message'),
          f('alias', 'Alias (dedup key)'),
          f('description', 'Description', { rows: 3 }),
          f('priority', 'Priority', { default: 'P3' }),
          f('tags', 'Tags', { list: true }),
        ],
      },
      {
        value: 'alert.list',
        label: ['List alerts', 'Listar alertas'],
        method: 'GET',
        path: '/v2/alerts',
        fields: [
          f('query', 'Query', { default: 'status: open' }),
          f('limit', 'Limit', { type: 'number' }),
        ],
      },
      {
        value: 'alert.ack',
        label: ['Acknowledge alert', 'Reconocer alerta'],
        method: 'POST',
        path: '/v2/alerts/{alertId}/acknowledge?identifierType=alias',
        fields: [r('alertId', 'Alias'), f('note', 'Note')],
      },
      {
        value: 'alert.close',
        label: ['Close alert', 'Cerrar alerta'],
        method: 'POST',
        path: '/v2/alerts/{alertId}/close?identifierType=alias',
        fields: [r('alertId', 'Alias'), f('note', 'Note')],
      },
      {
        value: 'alert.note',
        label: ['Add note to alert', 'Agregar nota a la alerta'],
        method: 'POST',
        path: '/v2/alerts/{alertId}/notes?identifierType=alias',
        fields: [r('alertId', 'Alias'), r('note', 'Note')],
      },
      {
        value: 'oncall.get',
        label: ['Who is on call', 'Quién está de guardia'],
        method: 'GET',
        path: '/v2/schedules/{schedule}/on-calls?scheduleIdentifierType=name',
        fields: [r('schedule', 'Schedule name')],
        extra: false,
      },
    ],
  }),

  service({
    type: 'uptimerobot',
    category: 'monitoring',
    icon: 'HeartPulse',
    color: 'bg-green-600',
    label: ['UptimeRobot', 'UptimeRobot'],
    description: [
      'Monitors: list, create, pause, resume and delete',
      'Monitores: listar, crear, pausar, reanudar y borrar',
    ],
    auth: { kind: 'body', provider: 'uptimerobot', key: 'api_key', label: 'API key' },
    base: 'https://api.uptimerobot.com/v2',
    bodyType: 'form',
    bodyError: b =>
      (b as { stat?: string })?.stat === 'fail'
        ? JSON.stringify((b as { error?: unknown }).error)
        : null,
    operations: [
      {
        value: 'monitor.list',
        label: ['List monitors', 'Listar monitores'],
        method: 'POST',
        path: '/getMonitors',
        fields: [f('search', 'Search'), f('statuses', 'Statuses', { description: '9 = down' })],
      },
      {
        value: 'monitor.create',
        label: ['Create HTTP monitor', 'Crear monitor HTTP'],
        method: 'POST',
        path: '/newMonitor',
        fields: [
          r('friendly_name', 'Name'),
          r('url', 'URL'),
          f('interval', 'Interval (s)', { type: 'number', default: 300 }),
        ],
        body: (_t, b) => ({ type: 1, ...b }),
      },
      {
        value: 'monitor.pause',
        label: ['Pause monitor', 'Pausar monitor'],
        method: 'POST',
        path: '/editMonitor',
        fields: [r('id', 'Monitor id')],
        body: (_t, b) => ({ ...b, status: 0 }),
      },
      {
        value: 'monitor.resume',
        label: ['Resume monitor', 'Reanudar monitor'],
        method: 'POST',
        path: '/editMonitor',
        fields: [r('id', 'Monitor id')],
        body: (_t, b) => ({ ...b, status: 1 }),
      },
      {
        value: 'monitor.delete',
        label: ['Delete monitor', 'Eliminar monitor'],
        method: 'POST',
        path: '/deleteMonitor',
        fields: [r('id', 'Monitor id')],
      },
    ],
  }),

  service({
    type: 'betterstack',
    category: 'monitoring',
    icon: 'Activity',
    color: 'bg-indigo-700',
    label: ['Better Stack Uptime', 'Better Stack Uptime'],
    description: ['Monitors and incidents', 'Monitores e incidentes'],
    auth: { kind: 'bearer', provider: 'betterstack', label: 'API token' },
    base: 'https://uptime.betterstack.com/api/v2',
    operations: [
      {
        value: 'monitor.list',
        label: ['List monitors', 'Listar monitores'],
        method: 'GET',
        path: '/monitors',
        fields: [f('url', 'URL')],
      },
      {
        value: 'monitor.pause',
        label: ['Pause monitor', 'Pausar monitor'],
        method: 'PATCH',
        path: '/monitors/{monitorId}',
        fields: [r('monitorId', 'Monitor id')],
        body: () => ({ paused: true }),
        extra: false,
      },
      {
        value: 'monitor.resume',
        label: ['Resume monitor', 'Reanudar monitor'],
        method: 'PATCH',
        path: '/monitors/{monitorId}',
        fields: [r('monitorId', 'Monitor id')],
        body: () => ({ paused: false }),
        extra: false,
      },
      {
        value: 'incident.list',
        label: ['List incidents', 'Listar incidentes'],
        method: 'GET',
        path: '/incidents',
        fields: [f('from', 'From (YYYY-MM-DD)'), f('resolved', 'Resolved', { type: 'boolean' })],
      },
      {
        value: 'incident.create',
        label: ['Create incident', 'Crear incidente'],
        method: 'POST',
        path: '/incidents',
        fields: [
          r('summary', 'Summary'),
          r('requester_email', 'Requester email'),
          f('description', 'Description', { rows: 3 }),
        ],
      },
      {
        value: 'incident.ack',
        label: ['Acknowledge incident', 'Reconocer incidente'],
        method: 'POST',
        path: '/incidents/{incidentId}/acknowledge',
        fields: [r('incidentId', 'Incident id')],
        extra: false,
      },
      {
        value: 'incident.resolve',
        label: ['Resolve incident', 'Resolver incidente'],
        method: 'POST',
        path: '/incidents/{incidentId}/resolve',
        fields: [r('incidentId', 'Incident id')],
        extra: false,
      },
    ],
  }),

  service({
    type: 'datadog',
    category: 'monitoring',
    icon: 'Dog',
    color: 'bg-purple-700',
    label: ['Datadog', 'Datadog'],
    description: [
      'Metrics, monitors, downtimes, events and logs',
      'Métricas, monitores, downtimes, eventos y logs',
    ],
    auth: { kind: 'header', provider: 'datadog', header: 'DD-API-KEY', label: 'API key' },
    base: {
      field: f('site', 'Site', {
        type: 'options',
        default: 'datadoghq.com',
        options: [
          'datadoghq.com',
          'us3.datadoghq.com',
          'us5.datadoghq.com',
          'datadoghq.eu',
          'ap1.datadoghq.com',
        ].map(v => ({ name: v, value: v })),
      }),
      build: v => `https://api.${v || 'datadoghq.com'}`,
    },
    headersFrom: t => ({ 'DD-APPLICATION-KEY': t.str('appKey') }),
    operations: [
      {
        value: 'metric.query',
        label: ['Query metrics', 'Consultar métricas'],
        method: 'GET',
        path: '/api/v1/query',
        fields: [
          r('appKey', 'Application key', { in: 'none' }),
          r('query', 'Query', { default: 'avg:system.cpu.user{*}' }),
          r('from', 'From (unix s)', { type: 'number' }),
          r('to', 'To (unix s)', { type: 'number' }),
        ],
      },
      {
        value: 'monitor.list',
        label: ['List monitors', 'Listar monitores'],
        method: 'GET',
        path: '/api/v1/monitor',
        fields: [
          r('appKey', 'Application key', { in: 'none' }),
          f('monitor_tags', 'Tags'),
          f('name', 'Name'),
        ],
      },
      {
        value: 'monitor.mute',
        label: ['Mute monitor', 'Silenciar monitor'],
        method: 'POST',
        path: '/api/v1/monitor/{monitorId}/mute',
        fields: [
          r('appKey', 'Application key', { in: 'none' }),
          r('monitorId', 'Monitor id'),
          f('end', 'Until (unix s)', { type: 'number' }),
        ],
      },
      {
        value: 'monitor.unmute',
        label: ['Unmute monitor', 'Reactivar monitor'],
        method: 'POST',
        path: '/api/v1/monitor/{monitorId}/unmute',
        fields: [r('appKey', 'Application key', { in: 'none' }), r('monitorId', 'Monitor id')],
      },
      {
        value: 'downtime.create',
        label: ['Schedule downtime', 'Programar downtime'],
        method: 'POST',
        path: '/api/v1/downtime',
        fields: [
          r('appKey', 'Application key', { in: 'none' }),
          r('scope', 'Scope', { list: true, default: 'env:prod' }),
          f('start', 'Start (unix s)', { type: 'number' }),
          f('end', 'End (unix s)', { type: 'number' }),
          f('message', 'Message'),
        ],
      },
      {
        value: 'event.list',
        label: ['List events', 'Listar eventos'],
        method: 'GET',
        path: '/api/v1/events',
        fields: [
          r('appKey', 'Application key', { in: 'none' }),
          r('start', 'Start (unix s)', { type: 'number' }),
          r('end', 'End (unix s)', { type: 'number' }),
          f('tags', 'Tags'),
        ],
      },
      {
        value: 'log.search',
        label: ['Search logs', 'Buscar logs'],
        method: 'POST',
        path: '/api/v2/logs/events/search',
        fields: [
          r('appKey', 'Application key', { in: 'none' }),
          r('logQuery', 'Query', { key: 'filter.query', default: 'service:api status:error' }),
          f('logFrom', 'From', { key: 'filter.from', default: 'now-15m' }),
          f('logTo', 'To', { key: 'filter.to', default: 'now' }),
          f('limit', 'Limit', { key: 'page.limit', type: 'number', default: 50 }),
        ],
      },
    ],
  }),

  service({
    type: 'newrelic',
    category: 'monitoring',
    icon: 'Gauge',
    color: 'bg-emerald-700',
    label: ['New Relic', 'New Relic'],
    description: [
      'NRQL queries and deployment markers (NerdGraph)',
      'Consultas NRQL y marcadores de deploy (NerdGraph)',
    ],
    auth: { kind: 'header', provider: 'newrelic', header: 'API-Key', label: 'User API key' },
    base: {
      field: f('region', 'Region', {
        type: 'options',
        default: 'us',
        options: [
          { name: 'US', value: 'us' },
          { name: 'EU', value: 'eu' },
        ],
      }),
      build: v =>
        v === 'eu' ? 'https://api.eu.newrelic.com/graphql' : 'https://api.newrelic.com/graphql',
    },
    bodyError: b => {
      const e = (b as { errors?: Array<{ message?: string }> })?.errors;
      return e?.length ? e.map(x => x.message).join('; ') : null;
    },
    operations: [
      {
        value: 'nrql',
        label: ['Run NRQL', 'Ejecutar NRQL'],
        method: 'POST',
        path: '',
        fields: [
          r('accountId', 'Account id', { in: 'none', type: 'number' }),
          r('nrql', 'NRQL', {
            rows: 3,
            in: 'none',
            default: 'SELECT count(*) FROM Transaction SINCE 30 minutes ago',
          }),
        ],
        body: t => ({
          query:
            'query ($a: Int!, $q: Nrql!) { actor { account(id: $a) { nrql(query: $q) { results } } } }',
          variables: { a: t.num('accountId'), q: t.str('nrql') },
        }),
        extra: false,
      },
      {
        value: 'deployment.mark',
        label: ['Mark deployment', 'Marcar deploy'],
        method: 'POST',
        path: '',
        fields: [
          r('entityGuid', 'Entity GUID', { in: 'none' }),
          r('version', 'Version', { in: 'none' }),
          f('changelog', 'Changelog', { in: 'none' }),
        ],
        body: t => ({
          query:
            'mutation ($e: EntityGuid!, $v: String!, $c: String) { changeTrackingCreateDeployment(deployment: { entityGuid: $e, version: $v, changelog: $c }) { deploymentId } }',
          variables: {
            e: t.str('entityGuid'),
            v: t.str('version'),
            c: t.str('changelog') || undefined,
          },
        }),
        extra: false,
      },
      {
        value: 'graphql',
        label: ['Run GraphQL', 'Ejecutar GraphQL'],
        method: 'POST',
        path: '',
        fields: [
          r('query', 'Query', { rows: 5, in: 'none' }),
          f('variables', 'Variables (JSON)', { rows: 2, in: 'none' }),
        ],
        body: t => ({ query: t.str('query'), variables: t.json('variables', {}) }),
        extra: false,
      },
    ],
  }),

  service({
    type: 'splunk',
    category: 'monitoring',
    icon: 'ScanSearch',
    color: 'bg-neutral-800',
    label: ['Splunk', 'Splunk'],
    description: [
      'Run searches and send events (HEC)',
      'Ejecutar búsquedas y enviar eventos (HEC)',
    ],
    auth: { kind: 'bearer', provider: 'splunk', label: 'Token' },
    base: {
      field: r('serverUrl', 'Server URL', { description: 'https://splunk.example.com:8089' }),
      build: v => v.replace(/\/+$/, ''),
    },
    bodyType: 'form',
    operations: [
      {
        value: 'search.oneshot',
        label: ['Run search (wait for results)', 'Ejecutar búsqueda (esperar resultados)'],
        method: 'POST',
        path: '/services/search/jobs',
        fields: [
          r('search', 'SPL', {
            rows: 3,
            default: 'search index=main error earliest=-15m | head 20',
          }),
        ],
        body: (_t, b) => ({ ...b, exec_mode: 'oneshot', output_mode: 'json' }),
      },
      {
        value: 'saved.list',
        label: ['List saved searches', 'Listar búsquedas guardadas'],
        method: 'GET',
        path: '/services/saved/searches?output_mode=json',
        extra: false,
      },
      {
        value: 'saved.dispatch',
        label: ['Run saved search', 'Ejecutar búsqueda guardada'],
        method: 'POST',
        path: '/services/saved/searches/{name}/dispatch?output_mode=json',
        fields: [r('name', 'Saved search name')],
      },
    ],
  }),

  service({
    type: 'grafana',
    category: 'monitoring',
    icon: 'ChartLine',
    color: 'bg-orange-500',
    label: ['Grafana', 'Grafana'],
    description: [
      'Dashboards, annotations, alerts and silences',
      'Dashboards, anotaciones, alertas y silencios',
    ],
    auth: { kind: 'bearer', provider: 'grafana', label: 'Service account token' },
    base: { field: r('serverUrl', 'Grafana URL'), build: v => `${v.replace(/\/+$/, '')}/api` },
    operations: [
      {
        value: 'dashboard.search',
        label: ['Search dashboards', 'Buscar dashboards'],
        method: 'GET',
        path: '/search',
        fields: [f('query', 'Query'), f('tag', 'Tag')],
      },
      {
        value: 'dashboard.get',
        label: ['Get dashboard', 'Obtener dashboard'],
        method: 'GET',
        path: '/dashboards/uid/{uid}',
        fields: [r('uid', 'Dashboard uid')],
        extra: false,
      },
      {
        value: 'annotation.create',
        label: ['Create annotation', 'Crear anotación'],
        method: 'POST',
        path: '/annotations',
        fields: [
          r('text', 'Text'),
          f('tags', 'Tags', { list: true }),
          f('dashboardUID', 'Dashboard uid'),
          f('time', 'Time (ms)', { type: 'number' }),
        ],
      },
      {
        value: 'alert.list',
        label: ['List firing alerts', 'Listar alertas activas'],
        method: 'GET',
        path: '/alertmanager/grafana/api/v2/alerts',
        fields: [f('filter', 'Filter', { description: 'alertname=HighCPU' })],
      },
      {
        value: 'silence.create',
        label: ['Create silence', 'Crear silencio'],
        method: 'POST',
        path: '/alertmanager/grafana/api/v2/silences',
        fields: [
          r('matchers', 'Matchers (JSON array)', {
            json: true,
            rows: 3,
            description: '[{"name":"alertname","value":"HighCPU","isRegex":false}]',
          }),
          r('startsAt', 'Starts (ISO)'),
          r('endsAt', 'Ends (ISO)'),
          r('createdBy', 'Created by', { default: 'operari' }),
          r('comment', 'Comment'),
        ],
      },
      {
        value: 'datasource.list',
        label: ['List data sources', 'Listar fuentes de datos'],
        method: 'GET',
        path: '/datasources',
        extra: false,
      },
    ],
  }),

  service({
    type: 'openai',
    category: 'ai',
    icon: 'Bot',
    color: 'bg-emerald-800',
    label: ['OpenAI', 'OpenAI'],
    description: [
      'Chat, embeddings, images, speech-free moderation and models',
      'Chat, embeddings, imágenes, moderación y modelos',
    ],
    auth: { kind: 'bearer', provider: 'ai.openai', label: 'API key' },
    base: {
      field: f('baseUrl', 'Base URL', {
        default: 'https://api.openai.com/v1',
        description: 'Any OpenAI-compatible API (Groq, Together, OpenRouter, vLLM…)',
      }),
      build: v => v || 'https://api.openai.com/v1',
    },
    operations: [
      {
        value: 'chat',
        label: ['Chat completion', 'Completado de chat'],
        method: 'POST',
        path: '/chat/completions',
        fields: [
          r('model', 'Model', { default: 'gpt-4o-mini' }),
          r('prompt', 'Prompt', { rows: 5, in: 'none' }),
          f('system', 'System prompt', { rows: 2, in: 'none' }),
          f('temperature', 'Temperature', { type: 'number' }),
          f('max_tokens', 'Max tokens', { type: 'number' }),
        ],
        body: (t, b) => ({
          ...b,
          messages: [
            ...(t.str('system') ? [{ role: 'system', content: t.str('system') }] : []),
            { role: 'user', content: t.str('prompt') },
          ],
        }),
      },
      {
        value: 'embedding',
        label: ['Create embedding', 'Crear embedding'],
        method: 'POST',
        path: '/embeddings',
        fields: [
          r('embeddingModel', 'Model', { key: 'model', default: 'text-embedding-3-small' }),
          r('input', 'Text', { rows: 3 }),
        ],
      },
      {
        value: 'image',
        label: ['Generate image', 'Generar imagen'],
        method: 'POST',
        path: '/images/generations',
        fields: [
          r('imageModel', 'Model', { key: 'model', default: 'gpt-image-1' }),
          r('prompt', 'Prompt', { rows: 5, in: 'none' }),
          f('size', 'Size', { default: '1024x1024' }),
        ],
        body: (t, b) => ({ ...b, prompt: t.str('prompt') }),
      },
      {
        value: 'moderation',
        label: ['Moderate text', 'Moderar texto'],
        method: 'POST',
        path: '/moderations',
        fields: [r('input', 'Text', { rows: 3 })],
      },
      {
        value: 'model.list',
        label: ['List models', 'Listar modelos'],
        method: 'GET',
        path: '/models',
        extra: false,
      },
    ],
  }),

  service({
    type: 'mistral',
    category: 'ai',
    icon: 'Wind',
    color: 'bg-orange-600',
    label: ['Mistral AI', 'Mistral AI'],
    description: ['Chat, embeddings and OCR', 'Chat, embeddings y OCR'],
    auth: { kind: 'bearer', provider: 'ai.mistral', label: 'API key' },
    base: 'https://api.mistral.ai/v1',
    operations: [
      {
        value: 'chat',
        label: ['Chat completion', 'Completado de chat'],
        method: 'POST',
        path: '/chat/completions',
        fields: [
          r('model', 'Model', { default: 'mistral-small-latest' }),
          r('prompt', 'Prompt', { rows: 5, in: 'none' }),
        ],
        body: (t, b) => ({ ...b, messages: [{ role: 'user', content: t.str('prompt') }] }),
      },
      {
        value: 'embedding',
        label: ['Create embedding', 'Crear embedding'],
        method: 'POST',
        path: '/embeddings',
        fields: [
          r('embeddingModel', 'Model', { key: 'model', default: 'mistral-embed' }),
          r('input', 'Text', { rows: 3, list: true }),
        ],
      },
      {
        value: 'ocr',
        label: ['OCR a document URL', 'OCR de un documento por URL'],
        method: 'POST',
        path: '/ocr',
        fields: [
          r('ocrModel', 'Model', { key: 'model', default: 'mistral-ocr-latest' }),
          r('documentUrl', 'Document URL', { key: 'document.document_url' }),
        ],
        body: (_t, b) => ({ ...b, document: { type: 'document_url', ...(b.document as object) } }),
      },
    ],
  }),

  service({
    type: 'perplexity',
    category: 'ai',
    icon: 'Search',
    color: 'bg-teal-700',
    label: ['Perplexity', 'Perplexity'],
    description: [
      'Answers grounded in live web search, with citations',
      'Respuestas basadas en búsqueda web en vivo, con citas',
    ],
    auth: { kind: 'bearer', provider: 'ai.perplexity', label: 'API key' },
    base: 'https://api.perplexity.ai',
    operations: [
      {
        value: 'chat',
        label: ['Ask', 'Preguntar'],
        method: 'POST',
        path: '/chat/completions',
        fields: [
          r('model', 'Model', { default: 'sonar' }),
          r('prompt', 'Question', { rows: 4, in: 'none' }),
        ],
        body: (t, b) => ({ ...b, messages: [{ role: 'user', content: t.str('prompt') }] }),
      },
    ],
  }),

  service({
    type: 'pinecone',
    category: 'ai',
    icon: 'TreePine',
    color: 'bg-neutral-800',
    label: ['Pinecone', 'Pinecone'],
    description: [
      'Upsert, query, fetch and delete vectors',
      'Insertar, consultar, obtener y borrar vectores',
    ],
    auth: { kind: 'header', provider: 'pinecone', header: 'Api-Key', label: 'API key' },
    base: {
      field: r('indexHost', 'Index host', {
        description: 'https://my-index-abc123.svc.us-east-1.pinecone.io',
      }),
      build: v => v.replace(/\/+$/, ''),
    },
    headers: { 'X-Pinecone-API-Version': '2024-07' },
    operations: [
      {
        value: 'upsert',
        label: ['Upsert vectors', 'Insertar vectores'],
        method: 'POST',
        path: '/vectors/upsert',
        fields: [
          r('vectors', 'Vectors (JSON array)', { json: true, rows: 4 }),
          f('namespace', 'Namespace'),
        ],
      },
      {
        value: 'query',
        label: ['Query', 'Consultar'],
        method: 'POST',
        path: '/query',
        fields: [
          r('vector', 'Vector (JSON array)', { json: true, rows: 2 }),
          r('topK', 'Top K', { type: 'number', default: 5 }),
          f('namespace', 'Namespace'),
          f('filter', 'Metadata filter (JSON)', { json: true, rows: 2 }),
          f('includeMetadata', 'Include metadata', { type: 'boolean', default: true }),
        ],
      },
      {
        value: 'fetch',
        label: ['Fetch by id', 'Obtener por id'],
        method: 'GET',
        path: '/vectors/fetch',
        fields: [r('ids', 'Ids'), f('namespace', 'Namespace')],
      },
      {
        value: 'delete',
        label: ['Delete vectors', 'Borrar vectores'],
        method: 'POST',
        path: '/vectors/delete',
        fields: [
          f('ids', 'Ids', { list: true }),
          f('namespace', 'Namespace'),
          f('deleteAll', 'Delete all in namespace', { type: 'boolean' }),
        ],
      },
      {
        value: 'stats',
        label: ['Index stats', 'Estadísticas del índice'],
        method: 'POST',
        path: '/describe_index_stats',
        extra: false,
      },
    ],
  }),

  service({
    type: 'qdrant',
    category: 'ai',
    icon: 'Boxes',
    color: 'bg-rose-600',
    label: ['Qdrant', 'Qdrant'],
    description: [
      'Collections, points, search and scroll',
      'Colecciones, puntos, búsqueda y scroll',
    ],
    auth: { kind: 'header', provider: 'qdrant', header: 'api-key', label: 'API key' },
    base: {
      field: r('serverUrl', 'Server URL', { description: 'https://xyz.cloud.qdrant.io:6333' }),
      build: v => v.replace(/\/+$/, ''),
    },
    operations: [
      {
        value: 'collection.list',
        label: ['List collections', 'Listar colecciones'],
        method: 'GET',
        path: '/collections',
        extra: false,
      },
      {
        value: 'collection.create',
        label: ['Create collection', 'Crear colección'],
        method: 'PUT',
        path: '/collections/{collection}',
        fields: [
          r('collection', 'Collection'),
          r('size', 'Vector size', { type: 'number', key: 'vectors.size', default: 1536 }),
          f('distance', 'Distance', { key: 'vectors.distance', default: 'Cosine' }),
        ],
      },
      {
        value: 'point.upsert',
        label: ['Upsert points', 'Insertar puntos'],
        method: 'PUT',
        path: '/collections/{collection}/points',
        fields: [
          r('collection', 'Collection'),
          r('points', 'Points (JSON array)', { json: true, rows: 4 }),
        ],
      },
      {
        value: 'point.search',
        label: ['Search', 'Buscar'],
        method: 'POST',
        path: '/collections/{collection}/points/query',
        fields: [
          r('collection', 'Collection'),
          r('query', 'Vector (JSON array)', { json: true, rows: 2 }),
          f('limit', 'Limit', { type: 'number', default: 5 }),
          f('filter', 'Filter (JSON)', { json: true, rows: 2 }),
          f('with_payload', 'With payload', { type: 'boolean', default: true }),
        ],
      },
      {
        value: 'point.scroll',
        label: ['Scroll points', 'Recorrer puntos'],
        method: 'POST',
        path: '/collections/{collection}/points/scroll',
        fields: [
          r('collection', 'Collection'),
          f('limit', 'Limit', { type: 'number', default: 5 }),
          f('filter', 'Filter (JSON)', { json: true, rows: 2 }),
        ],
      },
      {
        value: 'point.delete',
        label: ['Delete points', 'Borrar puntos'],
        method: 'POST',
        path: '/collections/{collection}/points/delete',
        fields: [
          r('collection', 'Collection'),
          r('pointIds', 'Point ids (JSON array)', { json: true, key: 'points' }),
        ],
      },
    ],
  }),

  service({
    type: 'elevenlabs',
    category: 'ai',
    icon: 'AudioLines',
    color: 'bg-neutral-900',
    label: ['ElevenLabs', 'ElevenLabs'],
    description: ['Voices, models and usage', 'Voces, modelos y uso'],
    auth: { kind: 'header', provider: 'elevenlabs', header: 'xi-api-key', label: 'API key' },
    base: 'https://api.elevenlabs.io/v1',
    operations: [
      {
        value: 'voice.list',
        label: ['List voices', 'Listar voces'],
        method: 'GET',
        path: '/voices',
        extra: false,
      },
      {
        value: 'model.list',
        label: ['List models', 'Listar modelos'],
        method: 'GET',
        path: '/models',
        extra: false,
      },
      {
        value: 'user.subscription',
        label: ['Usage and quota', 'Uso y cuota'],
        method: 'GET',
        path: '/user/subscription',
        extra: false,
      },
    ],
  }),

  service({
    type: 'replicate',
    category: 'ai',
    icon: 'Cpu',
    color: 'bg-neutral-800',
    label: ['Replicate', 'Replicate'],
    description: [
      'Run open models and check predictions',
      'Ejecutar modelos abiertos y revisar predicciones',
    ],
    auth: { kind: 'bearer', provider: 'replicate', label: 'API token' },
    base: 'https://api.replicate.com/v1',
    operations: [
      {
        value: 'prediction.create',
        label: ['Run model', 'Ejecutar modelo'],
        method: 'POST',
        path: '/models/{owner}/{model}/predictions',
        fields: [
          r('owner', 'Owner', { default: 'black-forest-labs' }),
          r('model', 'Model', { default: 'flux-schnell' }),
          r('input', 'Input (JSON)', { json: true, rows: 3 }),
        ],
        body: (t, b) => ({ ...b, input: t.json('input', {}) }),
      },
      {
        value: 'prediction.get',
        label: ['Get prediction', 'Obtener predicción'],
        method: 'GET',
        path: '/predictions/{predictionId}',
        fields: [r('predictionId', 'Prediction id')],
        extra: false,
      },
      {
        value: 'prediction.cancel',
        label: ['Cancel prediction', 'Cancelar predicción'],
        method: 'POST',
        path: '/predictions/{predictionId}/cancel',
        fields: [r('predictionId', 'Prediction id')],
        extra: false,
      },
    ],
  }),
];
