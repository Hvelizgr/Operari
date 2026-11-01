import type { CatalogNode } from '../define';
import { crud, f, type OpField, r, service, type ServiceOp } from '../service';

/** HubSpot CRM v3 object: properties live under `properties`. */
function hubspotObject(
  resource: string,
  labels: { one: [string, string]; many: [string, string] },
  object: string,
  props: OpField[]
): ServiceOp[] {
  return [
    ...crud(
      resource,
      labels,
      `/crm/v3/objects/${object}`,
      r(`${resource}Id`, `${labels.one[0]} id`),
      props.map(p => ({ ...p, key: `properties.${p.key ?? p.name}` })),
      {
        listQuery: [
          f('limit', 'Limit', { type: 'number', in: 'query' }),
          f('properties', 'Properties to return', { in: 'query', description: 'Comma-separated' }),
        ],
      }
    ),
    {
      value: `${resource}.search`,
      label: [`Search ${labels.many[0]}`, `Buscar ${labels.many[1]}`],
      method: 'POST',
      path: `/crm/v3/objects/${object}/search`,
      fields: [
        r('searchProperty', 'Property', { in: 'none' }),
        r('searchValue', 'Equals', { in: 'none' }),
      ],
      body: (t, b) => ({
        filterGroups: [
          {
            filters: [
              {
                propertyName: t.str('searchProperty'),
                operator: 'EQ',
                value: t.str('searchValue'),
              },
            ],
          },
        ],
        ...b,
      }),
    },
  ];
}

export const CRM_NODES: CatalogNode[] = [
  service({
    type: 'hubspot',
    category: 'crm',
    icon: 'Users',
    color: 'bg-orange-500',
    label: ['HubSpot', 'HubSpot'],
    description: [
      'Contacts, companies, deals and tickets (CRM v3)',
      'Contactos, empresas, negocios y tickets (CRM v3)',
    ],
    auth: { kind: 'bearer', provider: 'hubspot', label: 'Private app token' },
    base: 'https://api.hubapi.com',
    operations: [
      ...hubspotObject(
        'contact',
        { one: ['contact', 'contacto'], many: ['contacts', 'contactos'] },
        'contacts',
        [
          f('email', 'Email'),
          f('firstname', 'First name'),
          f('lastname', 'Last name'),
          f('phone', 'Phone'),
          f('company', 'Company'),
        ]
      ),
      ...hubspotObject(
        'company',
        { one: ['company', 'empresa'], many: ['companies', 'empresas'] },
        'companies',
        [f('name', 'Name'), f('domain', 'Domain'), f('industry', 'Industry')]
      ),
      ...hubspotObject('deal', { one: ['deal', 'negocio'], many: ['deals', 'negocios'] }, 'deals', [
        f('dealname', 'Deal name'),
        f('amount', 'Amount'),
        f('dealstage', 'Stage'),
        f('pipeline', 'Pipeline'),
      ]),
      ...hubspotObject(
        'ticket',
        { one: ['ticket', 'ticket'], many: ['tickets', 'tickets'] },
        'tickets',
        [
          f('subject', 'Subject'),
          f('content', 'Description', { rows: 3 }),
          f('hs_pipeline_stage', 'Stage'),
          f('hs_ticket_priority', 'Priority'),
        ]
      ),
      {
        value: 'association.create',
        label: ['Associate two records', 'Asociar dos registros'],
        method: 'PUT',
        path: '/crm/v4/objects/{fromObject}/{fromId}/associations/default/{toObject}/{toId}',
        fields: [
          r('fromObject', 'From object', { default: 'contacts' }),
          r('fromId', 'From id'),
          r('toObject', 'To object', { default: 'companies' }),
          r('toId', 'To id'),
        ],
        extra: false,
      },
    ],
  }),

  service({
    type: 'pipedrive',
    category: 'crm',
    icon: 'Handshake',
    color: 'bg-emerald-700',
    label: ['Pipedrive', 'Pipedrive'],
    description: [
      'Deals, persons, organizations, activities and notes',
      'Negocios, personas, organizaciones, actividades y notas',
    ],
    auth: { kind: 'query', provider: 'pipedrive', param: 'api_token', label: 'API token' },
    base: 'https://api.pipedrive.com/v1',
    bodyError: b =>
      (b as { success?: boolean })?.success === false
        ? String((b as { error?: string }).error ?? 'Pipedrive error')
        : null,
    operations: [
      ...crud(
        'deal',
        { one: ['deal', 'negocio'], many: ['deals', 'negocios'] },
        '/deals',
        r('dealId', 'Deal id'),
        [
          f('title', 'Title'),
          f('value', 'Value'),
          f('currency', 'Currency'),
          f('person_id', 'Person id', { type: 'number' }),
          f('org_id', 'Organization id', { type: 'number' }),
          f('stage_id', 'Stage id', { type: 'number' }),
          f('status', 'Status'),
        ],
        { updateMethod: 'PUT', listQuery: [f('limit', 'Limit', { type: 'number', in: 'query' })] }
      ),
      ...crud(
        'person',
        { one: ['person', 'persona'], many: ['persons', 'personas'] },
        '/persons',
        r('personId', 'Person id'),
        [
          f('name', 'Name'),
          f('email', 'Email'),
          f('phone', 'Phone'),
          f('org_id', 'Organization id', { type: 'number' }),
        ],
        { updateMethod: 'PUT' }
      ),
      ...crud(
        'organization',
        { one: ['organization', 'organización'], many: ['organizations', 'organizaciones'] },
        '/organizations',
        r('organizationId', 'Organization id'),
        [f('name', 'Name'), f('address', 'Address')],
        { updateMethod: 'PUT' }
      ),
      ...crud(
        'activity',
        { one: ['activity', 'actividad'], many: ['activities', 'actividades'] },
        '/activities',
        r('activityId', 'Activity id'),
        [
          f('subject', 'Subject'),
          f('type', 'Type', { default: 'call' }),
          f('due_date', 'Due date (YYYY-MM-DD)'),
          f('deal_id', 'Deal id', { type: 'number' }),
        ],
        { updateMethod: 'PUT' }
      ),
      {
        value: 'note.create',
        label: ['Add note', 'Agregar nota'],
        method: 'POST',
        path: '/notes',
        fields: [
          r('content', 'Content', { rows: 3 }),
          f('deal_id', 'Deal id', { type: 'number' }),
          f('person_id', 'Person id', { type: 'number' }),
          f('org_id', 'Organization id', { type: 'number' }),
        ],
      },
      {
        value: 'search',
        label: ['Search items', 'Buscar elementos'],
        method: 'GET',
        path: '/itemSearch',
        fields: [
          r('term', 'Term'),
          f('item_types', 'Item types', { description: 'deal,person,organization…' }),
        ],
      },
    ],
  }),

  service({
    type: 'salesforce',
    category: 'crm',
    icon: 'Cloud',
    color: 'bg-sky-500',
    label: ['Salesforce', 'Salesforce'],
    description: [
      'Any object (Lead, Contact, Account, Opportunity, Case…) and SOQL queries',
      'Cualquier objeto (Lead, Contact, Account, Opportunity, Case…) y consultas SOQL',
    ],
    auth: { kind: 'bearer', provider: 'salesforce', label: 'Access token' },
    base: {
      field: r('instanceUrl', 'Instance URL', { description: 'https://yourorg.my.salesforce.com' }),
      build: v => `${v.replace(/\/+$/, '')}/services/data/v60.0`,
    },
    operations: [
      {
        value: 'query',
        label: ['SOQL query', 'Consulta SOQL'],
        method: 'GET',
        path: '/query',
        fields: [r('q', 'SOQL', { rows: 3, description: 'SELECT Id, Name FROM Account LIMIT 10' })],
        extra: false,
      },
      {
        value: 'search',
        label: ['SOSL search', 'Búsqueda SOSL'],
        method: 'GET',
        path: '/search',
        fields: [r('q', 'SOSL', { rows: 2 })],
        extra: false,
      },
      {
        value: 'record.get',
        label: ['Get record', 'Obtener registro'],
        method: 'GET',
        path: '/sobjects/{sobject}/{recordId}',
        fields: [r('sobject', 'Object', { default: 'Contact' }), r('recordId', 'Record id')],
        extra: false,
      },
      {
        value: 'record.create',
        label: ['Create record', 'Crear registro'],
        method: 'POST',
        path: '/sobjects/{sobject}',
        fields: [
          r('sobject', 'Object', { default: 'Contact' }),
          r('fields', 'Fields (JSON)', { json: true, rows: 4, in: 'none' }),
        ],
        body: t => t.json('fields', {}),
        extra: false,
      },
      {
        value: 'record.update',
        label: ['Update record', 'Actualizar registro'],
        method: 'PATCH',
        path: '/sobjects/{sobject}/{recordId}',
        fields: [
          r('sobject', 'Object', { default: 'Contact' }),
          r('recordId', 'Record id'),
          r('fields', 'Fields (JSON)', { json: true, rows: 4, in: 'none' }),
        ],
        body: t => t.json('fields', {}),
        extra: false,
      },
      {
        value: 'record.upsert',
        label: ['Upsert by external id', 'Upsert por id externo'],
        method: 'PATCH',
        path: '/sobjects/{sobject}/{externalField}/{externalId}',
        fields: [
          r('sobject', 'Object', { default: 'Contact' }),
          r('externalField', 'External id field'),
          r('externalId', 'External id'),
          r('fields', 'Fields (JSON)', { json: true, rows: 4, in: 'none' }),
        ],
        body: t => t.json('fields', {}),
        extra: false,
      },
      {
        value: 'record.delete',
        label: ['Delete record', 'Eliminar registro'],
        method: 'DELETE',
        path: '/sobjects/{sobject}/{recordId}',
        fields: [r('sobject', 'Object', { default: 'Contact' }), r('recordId', 'Record id')],
        extra: false,
      },
      {
        value: 'object.describe',
        label: ['Describe object', 'Describir objeto'],
        method: 'GET',
        path: '/sobjects/{sobject}/describe',
        fields: [r('sobject', 'Object', { default: 'Contact' })],
        extra: false,
      },
    ],
  }),

  service({
    type: 'zohocrm',
    category: 'crm',
    icon: 'Contact',
    color: 'bg-red-600',
    label: ['Zoho CRM', 'Zoho CRM'],
    description: [
      'Records of any module (Leads, Contacts, Deals…)',
      'Registros de cualquier módulo (Leads, Contacts, Deals…)',
    ],
    auth: {
      kind: 'header',
      provider: 'zoho',
      header: 'Authorization',
      prefix: 'Zoho-oauthtoken ',
      label: 'OAuth access token',
    },
    base: {
      field: f('domain', 'Data center', {
        type: 'options',
        default: 'com',
        options: [
          { name: '.com', value: 'com' },
          { name: '.eu', value: 'eu' },
          { name: '.in', value: 'in' },
          { name: '.com.au', value: 'com.au' },
          { name: '.jp', value: 'jp' },
        ],
      }),
      build: v => `https://www.zohoapis.${v || 'com'}/crm/v6`,
    },
    operations: [
      {
        value: 'record.list',
        label: ['List records', 'Listar registros'],
        method: 'GET',
        path: '/{module}',
        fields: [
          r('module', 'Module', { default: 'Leads' }),
          f('fields', 'Fields', {
            description: 'Comma-separated, required by Zoho',
            default: 'id',
          }),
        ],
      },
      {
        value: 'record.get',
        label: ['Get record', 'Obtener registro'],
        method: 'GET',
        path: '/{module}/{recordId}',
        fields: [r('module', 'Module', { default: 'Leads' }), r('recordId', 'Record id')],
        extra: false,
      },
      {
        value: 'record.create',
        label: ['Create record', 'Crear registro'],
        method: 'POST',
        path: '/{module}',
        fields: [
          r('module', 'Module', { default: 'Leads' }),
          r('record', 'Record (JSON)', { json: true, rows: 4, in: 'none' }),
        ],
        body: t => ({ data: [t.json('record', {})] }),
        extra: false,
      },
      {
        value: 'record.update',
        label: ['Update record', 'Actualizar registro'],
        method: 'PUT',
        path: '/{module}/{recordId}',
        fields: [
          r('module', 'Module', { default: 'Leads' }),
          r('recordId', 'Record id'),
          r('record', 'Record (JSON)', { json: true, rows: 4, in: 'none' }),
        ],
        body: t => ({ data: [t.json('record', {})] }),
        extra: false,
      },
      {
        value: 'record.delete',
        label: ['Delete record', 'Eliminar registro'],
        method: 'DELETE',
        path: '/{module}/{recordId}',
        fields: [r('module', 'Module', { default: 'Leads' }), r('recordId', 'Record id')],
        extra: false,
      },
      {
        value: 'record.search',
        label: ['Search records', 'Buscar registros'],
        method: 'GET',
        path: '/{module}/search',
        fields: [
          r('module', 'Module', { default: 'Leads' }),
          f('email', 'Email'),
          f('word', 'Word'),
          f('criteria', 'Criteria', { description: '(Last_Name:equals:Smith)' }),
        ],
      },
    ],
  }),

  service({
    type: 'close',
    category: 'crm',
    icon: 'PhoneCall',
    color: 'bg-blue-700',
    label: ['Close', 'Close'],
    description: [
      'Leads, contacts, opportunities and tasks',
      'Leads, contactos, oportunidades y tareas',
    ],
    auth: { kind: 'basicSecret', provider: 'close', password: '', label: 'API key' },
    base: 'https://api.close.com/api/v1',
    operations: [
      ...crud(
        'lead',
        { one: ['lead', 'lead'], many: ['leads', 'leads'] },
        '/lead/',
        r('leadId', 'Lead id'),
        [f('name', 'Company name'), f('description', 'Description'), f('url', 'URL')],
        {
          updateMethod: 'PUT',
          idPath: '/lead/{leadId}/',
          listQuery: [f('query', 'Search query', { in: 'query' })],
        }
      ),
      ...crud(
        'contact',
        { one: ['contact', 'contacto'], many: ['contacts', 'contactos'] },
        '/contact/',
        r('contactId', 'Contact id'),
        [f('lead_id', 'Lead id'), f('name', 'Name'), f('title', 'Title')],
        { updateMethod: 'PUT', idPath: '/contact/{contactId}/' }
      ),
      ...crud(
        'opportunity',
        { one: ['opportunity', 'oportunidad'], many: ['opportunities', 'oportunidades'] },
        '/opportunity/',
        r('opportunityId', 'Opportunity id'),
        [
          f('lead_id', 'Lead id'),
          f('value', 'Value (cents)', { type: 'number' }),
          f('note', 'Note'),
        ],
        { updateMethod: 'PUT', idPath: '/opportunity/{opportunityId}/' }
      ),
      {
        value: 'task.create',
        label: ['Create task', 'Crear tarea'],
        method: 'POST',
        path: '/task/',
        fields: [r('lead_id', 'Lead id'), r('text', 'Text'), f('date', 'Due date (YYYY-MM-DD)')],
      },
    ],
  }),

  service({
    type: 'attio',
    category: 'crm',
    icon: 'Table2',
    color: 'bg-zinc-800',
    label: ['Attio', 'Attio'],
    description: [
      'Records of people, companies and custom objects',
      'Registros de personas, empresas y objetos propios',
    ],
    auth: { kind: 'bearer', provider: 'attio', label: 'Access token' },
    base: 'https://api.attio.com/v2',
    operations: [
      {
        value: 'record.query',
        label: ['Query records', 'Consultar registros'],
        method: 'POST',
        path: '/objects/{object}/records/query',
        fields: [
          r('object', 'Object', { default: 'people' }),
          f('limit', 'Limit', { type: 'number' }),
        ],
      },
      {
        value: 'record.get',
        label: ['Get record', 'Obtener registro'],
        method: 'GET',
        path: '/objects/{object}/records/{recordId}',
        fields: [r('object', 'Object', { default: 'people' }), r('recordId', 'Record id')],
        extra: false,
      },
      {
        value: 'record.create',
        label: ['Create record', 'Crear registro'],
        method: 'POST',
        path: '/objects/{object}/records',
        fields: [
          r('object', 'Object', { default: 'people' }),
          r('values', 'Values (JSON)', { json: true, rows: 4, key: 'data.values' }),
        ],
      },
      {
        value: 'record.assert',
        label: ['Create or update record', 'Crear o actualizar registro'],
        method: 'PUT',
        path: '/objects/{object}/records',
        fields: [
          r('object', 'Object', { default: 'people' }),
          r('matching_attribute', 'Matching attribute', {
            in: 'query',
            default: 'email_addresses',
          }),
          r('values', 'Values (JSON)', { json: true, rows: 4, key: 'data.values' }),
        ],
      },
      {
        value: 'record.delete',
        label: ['Delete record', 'Eliminar registro'],
        method: 'DELETE',
        path: '/objects/{object}/records/{recordId}',
        fields: [r('object', 'Object', { default: 'people' }), r('recordId', 'Record id')],
        extra: false,
      },
      {
        value: 'note.create',
        label: ['Create note', 'Crear nota'],
        method: 'POST',
        path: '/notes',
        fields: [
          r('parent_object', 'Parent object', { key: 'data.parent_object', default: 'people' }),
          r('parent_record_id', 'Parent record id', { key: 'data.parent_record_id' }),
          r('title', 'Title', { key: 'data.title' }),
          r('content', 'Content', { key: 'data.content', rows: 3 }),
          f('format', 'Format', { key: 'data.format', default: 'plaintext' }),
        ],
      },
    ],
  }),

  service({
    type: 'activecampaign',
    category: 'crm',
    icon: 'Megaphone',
    color: 'bg-blue-600',
    label: ['ActiveCampaign', 'ActiveCampaign'],
    description: ['Contacts, deals, tags and lists', 'Contactos, negocios, etiquetas y listas'],
    auth: { kind: 'header', provider: 'activecampaign', header: 'Api-Token', label: 'API key' },
    base: {
      field: r('accountUrl', 'Account URL', { description: 'https://youraccount.api-us1.com' }),
      build: v => `${v.replace(/\/+$/, '')}/api/3`,
    },
    operations: [
      ...crud(
        'contact',
        { one: ['contact', 'contacto'], many: ['contacts', 'contactos'] },
        '/contacts',
        r('contactId', 'Contact id'),
        [
          f('email', 'Email', { key: 'contact.email' }),
          f('firstName', 'First name', { key: 'contact.firstName' }),
          f('lastName', 'Last name', { key: 'contact.lastName' }),
          f('phone', 'Phone', { key: 'contact.phone' }),
        ],
        { updateMethod: 'PUT', listQuery: [f('email', 'Email', { in: 'query' })] }
      ),
      {
        value: 'contact.sync',
        label: ['Create or update contact', 'Crear o actualizar contacto'],
        method: 'POST',
        path: '/contact/sync',
        fields: [
          r('email', 'Email', { key: 'contact.email' }),
          f('firstName', 'First name', { key: 'contact.firstName' }),
          f('lastName', 'Last name', { key: 'contact.lastName' }),
        ],
      },
      {
        value: 'contact.tag',
        label: ['Add tag to contact', 'Etiquetar contacto'],
        method: 'POST',
        path: '/contactTags',
        fields: [
          r('contact', 'Contact id', { key: 'contactTag.contact' }),
          r('tag', 'Tag id', { key: 'contactTag.tag' }),
        ],
      },
      {
        value: 'contact.list.add',
        label: ['Subscribe contact to list', 'Suscribir contacto a lista'],
        method: 'POST',
        path: '/contactLists',
        fields: [
          r('list', 'List id', { key: 'contactList.list' }),
          r('contact', 'Contact id', { key: 'contactList.contact' }),
          f('status', 'Status', { key: 'contactList.status', default: '1' }),
        ],
      },
      ...crud(
        'deal',
        { one: ['deal', 'negocio'], many: ['deals', 'negocios'] },
        '/deals',
        r('dealId', 'Deal id'),
        [
          f('title', 'Title', { key: 'deal.title' }),
          f('value', 'Value (cents)', { key: 'deal.value', type: 'number' }),
          f('currency', 'Currency', { key: 'deal.currency' }),
          f('contact', 'Contact id', { key: 'deal.contact' }),
          f('stage', 'Stage id', { key: 'deal.stage' }),
        ],
        { updateMethod: 'PUT' }
      ),
      {
        value: 'tag.list',
        label: ['List tags', 'Listar etiquetas'],
        method: 'GET',
        path: '/tags',
        extra: false,
      },
    ],
  }),

  service({
    type: 'intercom',
    category: 'crm',
    icon: 'MessageCircle',
    color: 'bg-blue-500',
    label: ['Intercom', 'Intercom'],
    description: [
      'Contacts, companies, conversations and notes',
      'Contactos, empresas, conversaciones y notas',
    ],
    auth: { kind: 'bearer', provider: 'intercom', label: 'Access token' },
    base: 'https://api.intercom.io',
    headers: { 'Intercom-Version': '2.11' },
    operations: [
      ...crud(
        'contact',
        { one: ['contact', 'contacto'], many: ['contacts', 'contactos'] },
        '/contacts',
        r('contactId', 'Contact id'),
        [
          f('role', 'Role', { default: 'user' }),
          f('email', 'Email'),
          f('name', 'Name'),
          f('external_id', 'External id'),
        ],
        { updateMethod: 'PUT' }
      ),
      {
        value: 'contact.search',
        label: ['Search contacts by email', 'Buscar contactos por email'],
        method: 'POST',
        path: '/contacts/search',
        fields: [r('email', 'Email', { in: 'none' })],
        body: t => ({ query: { field: 'email', operator: '=', value: t.str('email') } }),
        extra: false,
      },
      {
        value: 'contact.note',
        label: ['Add note to contact', 'Agregar nota al contacto'],
        method: 'POST',
        path: '/contacts/{contactId}/notes',
        fields: [r('contactId', 'Contact id'), r('body', 'Note', { rows: 3 })],
      },
      {
        value: 'conversation.list',
        label: ['List conversations', 'Listar conversaciones'],
        method: 'GET',
        path: '/conversations',
        fields: [f('per_page', 'Per page', { type: 'number' })],
      },
      {
        value: 'conversation.get',
        label: ['Get conversation', 'Obtener conversación'],
        method: 'GET',
        path: '/conversations/{conversationId}',
        fields: [r('conversationId', 'Conversation id')],
        extra: false,
      },
      {
        value: 'conversation.reply',
        label: ['Reply to conversation', 'Responder conversación'],
        method: 'POST',
        path: '/conversations/{conversationId}/reply',
        fields: [
          r('conversationId', 'Conversation id'),
          r('body', 'Message', { rows: 3 }),
          r('admin_id', 'Admin id'),
          f('message_type', 'Type', { default: 'comment' }),
          f('type', 'Sender type', { default: 'admin' }),
        ],
      },
      {
        value: 'company.list',
        label: ['List companies', 'Listar empresas'],
        method: 'GET',
        path: '/companies',
        extra: false,
      },
    ],
  }),

  service({
    type: 'freshsales',
    category: 'crm',
    icon: 'BadgeDollarSign',
    color: 'bg-teal-600',
    label: ['Freshsales', 'Freshsales'],
    description: ['Contacts, accounts and deals', 'Contactos, cuentas y negocios'],
    auth: {
      kind: 'header',
      provider: 'freshsales',
      header: 'Authorization',
      prefix: 'Token token=',
      label: 'API key',
    },
    base: {
      field: r('domain', 'Bundle alias', { description: 'acme for acme.myfreshworks.com' }),
      build: v => `https://${v}.myfreshworks.com/crm/sales/api`,
    },
    operations: [
      ...crud(
        'contact',
        { one: ['contact', 'contacto'], many: ['contacts', 'contactos'] },
        '/contacts',
        r('contactId', 'Contact id'),
        [
          f('email', 'Email', { key: 'contact.email' }),
          f('first_name', 'First name', { key: 'contact.first_name' }),
          f('last_name', 'Last name', { key: 'contact.last_name' }),
        ],
        { updateMethod: 'PUT', skip: ['list'] }
      ),
      ...crud(
        'deal',
        { one: ['deal', 'negocio'], many: ['deals', 'negocios'] },
        '/deals',
        r('dealId', 'Deal id'),
        [
          f('name', 'Name', { key: 'deal.name' }),
          f('amount', 'Amount', { key: 'deal.amount', type: 'number' }),
        ],
        { updateMethod: 'PUT', skip: ['list'] }
      ),
      {
        value: 'search',
        label: ['Search', 'Buscar'],
        method: 'GET',
        path: '/search',
        fields: [
          r('q', 'Query'),
          f('include', 'Include', { default: 'contact,sales_account,deal' }),
        ],
      },
    ],
  }),
];
