import { apiNode, basic, type CatalogNode, enc, MAIN } from './define';

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'productivity',
  icon,
  color: 'bg-indigo-600',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const title = {
  name: 'title',
  displayName: 'Title',
  type: 'string' as const,
  required: true,
  typeOptions: { expression: true },
};
const details = (name = 'description', displayName = 'Description') => ({
  name,
  displayName,
  type: 'string' as const,
  typeOptions: { rows: 4, expression: true },
});

const LINEAR_CREATE = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) { success issue { id identifier url } }
}`;

export const PRODUCTIVITY_NODES: CatalogNode[] = [
  apiNode({
    ...meta(
      'linear.issue',
      'SquareKanban',
      ['Linear issue', 'Issue en Linear'],
      ['Create an issue in a Linear team', 'Crear un issue en un equipo de Linear']
    ),
    properties: [
      { name: 'apiKey', displayName: 'API key', type: 'secret', required: true },
      { name: 'teamId', displayName: 'Team id', type: 'string', required: true },
      title,
      details(),
      {
        name: 'priority',
        displayName: 'Priority',
        type: 'options',
        default: '0',
        options: [
          { name: 'No priority', value: '0' },
          { name: 'Urgent', value: '1' },
          { name: 'High', value: '2' },
          { name: 'Medium', value: '3' },
          { name: 'Low', value: '4' },
        ],
      },
    ],
    request: t => ({
      method: 'POST',
      url: 'https://api.linear.app/graphql',
      headers: { Authorization: t.str('apiKey') },
      body: {
        query: LINEAR_CREATE,
        variables: {
          input: {
            teamId: t.str('teamId'),
            title: t.str('title'),
            description: t.str('description'),
            priority: Number(t.str('priority') || 0),
          },
        },
      },
      describe: `Linear issue — ${t.str('title').slice(0, 100)}`,
    }),
    bodyError: body => {
      const b = body as {
        errors?: Array<{ message?: string }>;
        data?: { issueCreate?: { success?: boolean } };
      };
      if (b?.errors?.length) return b.errors.map(e => e.message).join('; ');
      return b?.data?.issueCreate?.success === false ? 'issueCreate returned success: false' : null;
    },
    shape: (body, status) => {
      const issue = (
        (body ?? {}) as {
          data?: { issueCreate?: { issue?: { id: string; identifier: string; url: string } } };
        }
      ).data?.issueCreate?.issue;
      return { status, id: issue?.id, identifier: issue?.identifier, url: issue?.url };
    },
  }),
  apiNode({
    ...meta(
      'notion.page',
      'NotebookPen',
      ['Notion page', 'Página de Notion'],
      [
        'Add a page to a Notion database (postmortems, incident logs, notes)',
        'Agregar una página a una base de datos de Notion (postmortems, bitácoras, notas)',
      ]
    ),
    properties: [
      { name: 'token', displayName: 'Integration token', type: 'secret', required: true },
      { name: 'databaseId', displayName: 'Database id', type: 'string', required: true },
      title,
      {
        name: 'titleProperty',
        displayName: 'Title column',
        type: 'string',
        default: 'Name',
        description: 'Name of the database’s title column.',
      },
      details('content', 'Content'),
      {
        name: 'properties',
        displayName: 'Other columns (Notion JSON)',
        type: 'string',
        description: 'Raw Notion property values, e.g. {"Status": {"select": {"name": "Open"}}}',
        typeOptions: { rows: 3, expression: true },
      },
    ],
    request: t => {
      const content = t.str('content');
      return {
        method: 'POST',
        url: 'https://api.notion.com/v1/pages',
        headers: { Authorization: `Bearer ${t.str('token')}`, 'Notion-Version': '2022-06-28' },
        body: {
          parent: { database_id: t.str('databaseId') },
          properties: {
            ...t.json<Record<string, unknown>>('properties', {}),
            [t.str('titleProperty') || 'Name']: {
              title: [{ text: { content: t.str('title').slice(0, 2000) } }],
            },
          },
          ...(content
            ? {
                children: content
                  .split(/\n{2,}/)
                  .slice(0, 100)
                  .map(p => ({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                      rich_text: [{ type: 'text', text: { content: p.slice(0, 2000) } }],
                    },
                  })),
              }
            : {}),
        },
        describe: `Notion page — ${t.str('title').slice(0, 100)}`,
      };
    },
    shape: (body, status) => {
      const b = (body ?? {}) as { id?: string; url?: string };
      return { status, pageId: b.id, url: b.url };
    },
  }),
  apiNode({
    ...meta(
      'trello.card',
      'Trello',
      ['Trello card', 'Tarjeta de Trello'],
      ['Create a card in a Trello list', 'Crear una tarjeta en una lista de Trello']
    ),
    properties: [
      { name: 'apiKey', displayName: 'API key', type: 'string', required: true },
      { name: 'token', displayName: 'Token', type: 'secret', required: true },
      { name: 'listId', displayName: 'List id', type: 'string', required: true },
      title,
      details(),
    ],
    request: t => {
      const params = new URLSearchParams({
        idList: t.str('listId'),
        name: t.str('title'),
        desc: t.str('description'),
        key: t.str('apiKey'),
        token: t.str('token'),
      });
      return {
        method: 'POST',
        url: `https://api.trello.com/1/cards?${params}`,
        describe: `Trello card — ${t.str('title').slice(0, 100)}`,
      };
    },
    shape: (body, status) => {
      const b = (body ?? {}) as { id?: string; shortUrl?: string };
      return { status, cardId: b.id, url: b.shortUrl };
    },
  }),
  apiNode({
    ...meta(
      'asana.task',
      'ListChecks',
      ['Asana task', 'Tarea de Asana'],
      ['Create a task in an Asana project', 'Crear una tarea en un proyecto de Asana']
    ),
    properties: [
      { name: 'token', displayName: 'Personal access token', type: 'secret', required: true },
      { name: 'projectId', displayName: 'Project id', type: 'string', required: true },
      title,
      details('notes', 'Notes'),
      {
        name: 'assignee',
        displayName: 'Assignee',
        type: 'string',
        description: 'User id or email.',
      },
      {
        name: 'dueOn',
        displayName: 'Due date',
        type: 'string',
        description: 'YYYY-MM-DD',
        typeOptions: { expression: true },
      },
    ],
    request: t => ({
      method: 'POST',
      url: 'https://app.asana.com/api/1.0/tasks',
      headers: { Authorization: `Bearer ${t.str('token')}` },
      body: {
        data: {
          name: t.str('title'),
          notes: t.str('notes'),
          projects: [t.str('projectId')],
          ...(t.str('assignee') ? { assignee: t.str('assignee') } : {}),
          ...(t.str('dueOn') ? { due_on: t.str('dueOn') } : {}),
        },
      },
      describe: `Asana task — ${t.str('title').slice(0, 100)}`,
    }),
    shape: (body, status) => {
      const d = ((body ?? {}) as { data?: { gid?: string; permalink_url?: string } }).data;
      return { status, taskId: d?.gid, url: d?.permalink_url };
    },
  }),
  apiNode({
    ...meta(
      'clickup.task',
      'CheckSquare',
      ['ClickUp task', 'Tarea de ClickUp'],
      ['Create a task in a ClickUp list', 'Crear una tarea en una lista de ClickUp']
    ),
    properties: [
      { name: 'token', displayName: 'API token', type: 'secret', required: true },
      { name: 'listId', displayName: 'List id', type: 'string', required: true },
      title,
      details(),
      {
        name: 'priority',
        displayName: 'Priority',
        type: 'options',
        default: '3',
        options: [
          { name: 'Urgent', value: '1' },
          { name: 'High', value: '2' },
          { name: 'Normal', value: '3' },
          { name: 'Low', value: '4' },
        ],
      },
    ],
    request: t => ({
      method: 'POST',
      url: `https://api.clickup.com/api/v2/list/${enc(t.str('listId'))}/task`,
      headers: { Authorization: t.str('token') },
      body: {
        name: t.str('title'),
        description: t.str('description'),
        priority: Number(t.str('priority') || 3),
      },
      describe: `ClickUp task — ${t.str('title').slice(0, 100)}`,
    }),
    shape: (body, status) => {
      const b = (body ?? {}) as { id?: string; url?: string };
      return { status, taskId: b.id, url: b.url };
    },
  }),
  apiNode({
    ...meta(
      'airtable.record',
      'Table2',
      ['Airtable', 'Airtable'],
      [
        'Create a record or list records from an Airtable table',
        'Crear un registro o listar registros de una tabla de Airtable',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'create',
        options: [
          { name: 'Create record', value: 'create' },
          { name: 'List records', value: 'list' },
        ],
      },
      { name: 'token', displayName: 'Personal access token', type: 'secret', required: true },
      {
        name: 'baseId',
        displayName: 'Base id',
        type: 'string',
        required: true,
        description: 'app…',
      },
      { name: 'table', displayName: 'Table name or id', type: 'string', required: true },
      {
        name: 'fields',
        displayName: 'Fields (JSON)',
        type: 'string',
        required: true,
        typeOptions: { rows: 4, expression: true },
        displayOptions: { show: { action: ['create'] } },
      },
      {
        name: 'filter',
        displayName: 'Filter formula',
        type: 'string',
        description: "e.g. {Status} = 'Open'",
        displayOptions: { show: { action: ['list'] } },
      },
      {
        name: 'maxRecords',
        displayName: 'Max records',
        type: 'number',
        default: 50,
        displayOptions: { show: { action: ['list'] } },
      },
    ],
    request: t => {
      const url = `https://api.airtable.com/v0/${enc(t.str('baseId'))}/${enc(t.str('table'))}`;
      const headers = { Authorization: `Bearer ${t.str('token')}` };
      if (t.str('action') === 'list') {
        const params = new URLSearchParams({
          maxRecords: String(Math.max(1, t.num('maxRecords'))),
        });
        if (t.str('filter')) params.set('filterByFormula', t.str('filter'));
        return {
          method: 'GET',
          url: `${url}?${params}`,
          headers,
          describe: `Airtable list ${t.str('table')}`,
        };
      }
      return {
        method: 'POST',
        url,
        headers,
        body: { fields: t.json('fields', {}), typecast: true },
        describe: `Airtable create in ${t.str('table')}`,
      };
    },
    shape: (body, status) => {
      const b = (body ?? {}) as {
        id?: string;
        fields?: unknown;
        records?: Array<{ id: string; fields: object }>;
      };
      if (b.records)
        return {
          status,
          records: b.records.map(r => ({ id: r.id, ...r.fields })),
          count: b.records.length,
        };
      return { status, recordId: b.id, fields: b.fields };
    },
  }),
  apiNode({
    ...meta(
      'zendesk.ticket',
      'LifeBuoy',
      ['Zendesk ticket', 'Ticket de Zendesk'],
      ['Open a support ticket in Zendesk', 'Abrir un ticket de soporte en Zendesk']
    ),
    properties: [
      {
        name: 'subdomain',
        displayName: 'Subdomain',
        type: 'string',
        required: true,
        description: 'acme for acme.zendesk.com',
      },
      { name: 'email', displayName: 'Agent email', type: 'string', required: true },
      { name: 'apiToken', displayName: 'API token', type: 'secret', required: true },
      { ...title, displayName: 'Subject' },
      { ...details('body', 'Comment') },
      {
        name: 'priority',
        displayName: 'Priority',
        type: 'options',
        default: 'normal',
        options: ['low', 'normal', 'high', 'urgent'].map(v => ({ name: v, value: v })),
      },
    ],
    request: t => {
      const sub = t.str('subdomain');
      if (!/^[a-z0-9-]+$/i.test(sub)) return 'subdomain must be letters, digits or dashes';
      return {
        method: 'POST',
        url: `https://${sub}.zendesk.com/api/v2/tickets.json`,
        headers: { Authorization: basic(`${t.str('email')}/token`, t.str('apiToken')) },
        body: {
          ticket: {
            subject: t.str('title'),
            comment: { body: t.str('body') || t.str('title') },
            priority: t.str('priority'),
          },
        },
        describe: `Zendesk ticket — ${t.str('title').slice(0, 100)}`,
      };
    },
    shape: (body, status) => {
      const tk = ((body ?? {}) as { ticket?: { id?: number; status?: string } }).ticket;
      return { status, ticketId: tk?.id, ticketStatus: tk?.status };
    },
  }),
  apiNode({
    ...meta(
      'hubspot.contact',
      'Contact',
      ['HubSpot contact', 'Contacto de HubSpot'],
      ['Create a contact in HubSpot CRM', 'Crear un contacto en el CRM de HubSpot']
    ),
    properties: [
      { name: 'token', displayName: 'Private app token', type: 'secret', required: true },
      {
        name: 'email',
        displayName: 'Email',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      {
        name: 'firstname',
        displayName: 'First name',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'lastname',
        displayName: 'Last name',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'extra',
        displayName: 'Other properties (JSON)',
        type: 'string',
        typeOptions: { rows: 3, expression: true },
      },
    ],
    request: t => ({
      method: 'POST',
      url: 'https://api.hubapi.com/crm/v3/objects/contacts',
      headers: { Authorization: `Bearer ${t.str('token')}` },
      body: {
        properties: {
          ...t.json<Record<string, unknown>>('extra', {}),
          email: t.str('email'),
          ...(t.str('firstname') ? { firstname: t.str('firstname') } : {}),
          ...(t.str('lastname') ? { lastname: t.str('lastname') } : {}),
        },
      },
      describe: `HubSpot contact ${t.str('email')}`,
    }),
    shape: (body, status) => ({ status, contactId: (body as { id?: string })?.id }),
  }),
];
