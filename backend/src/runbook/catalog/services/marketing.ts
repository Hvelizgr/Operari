import { createHash } from 'node:crypto';

import type { CatalogNode, StepTools } from '../define';
import { crud, f, r, service } from '../service';

const md5 = (s: string) => createHash('md5').update(s.trim().toLowerCase()).digest('hex');

/** Mailchimp addresses members by the MD5 of the lower-cased email. */
const memberHash = (t: StepTools) => ({ hash: md5(t.str('email')) });

export const MARKETING_NODES: CatalogNode[] = [
  service({
    type: 'mailchimp',
    category: 'marketing',
    icon: 'Mail',
    color: 'bg-yellow-400',
    label: ['Mailchimp', 'Mailchimp'],
    description: [
      'Audience members, tags and campaigns',
      'Miembros de audiencias, etiquetas y campañas',
    ],
    auth: {
      kind: 'basicSecret',
      provider: 'mailchimp',
      user: 'anystring',
      label: 'API key (…-us21)',
    },
    base: {
      field: r('dc', 'Data center', { description: 'The suffix of your API key, e.g. us21' }),
      build: v => `https://${v}.api.mailchimp.com/3.0`,
    },
    operations: [
      {
        value: 'member.upsert',
        label: ['Add or update member', 'Agregar o actualizar miembro'],
        method: 'PUT',
        path: '/lists/{listId}/members/{hash}',
        fields: [
          r('listId', 'Audience id'),
          r('email', 'Email', { key: 'email_address' }),
          f('status_if_new', 'Status if new', { default: 'subscribed' }),
          f('merge_fields', 'Merge fields (JSON)', { json: true, rows: 2 }),
        ],
        pathParams: memberHash,
      },
      {
        value: 'member.get',
        label: ['Get member', 'Obtener miembro'],
        method: 'GET',
        path: '/lists/{listId}/members/{hash}',
        fields: [r('listId', 'Audience id'), r('email', 'Email', { in: 'none' })],
        pathParams: memberHash,
        extra: false,
      },
      {
        value: 'member.list',
        label: ['List members', 'Listar miembros'],
        method: 'GET',
        path: '/lists/{listId}/members',
        fields: [
          r('listId', 'Audience id'),
          f('count', 'Count', { type: 'number' }),
          f('status', 'Status'),
        ],
      },
      {
        value: 'member.archive',
        label: ['Archive member', 'Archivar miembro'],
        method: 'DELETE',
        path: '/lists/{listId}/members/{hash}',
        fields: [r('listId', 'Audience id'), r('email', 'Email', { in: 'none' })],
        pathParams: memberHash,
        extra: false,
      },
      {
        value: 'member.tags',
        label: ['Add or remove tags', 'Agregar o quitar etiquetas'],
        method: 'POST',
        path: '/lists/{listId}/members/{hash}/tags',
        fields: [
          r('listId', 'Audience id'),
          r('email', 'Email', { in: 'none' }),
          r('tags', 'Tags', { list: true, in: 'none', description: 'Comma-separated' }),
          f('tagStatus', 'Action', {
            type: 'options',
            default: 'active',
            in: 'none',
            options: [
              { name: 'Add', value: 'active' },
              { name: 'Remove', value: 'inactive' },
            ],
          }),
        ],
        body: t => ({
          tags: t
            .list('tags')
            .map(n => ({ name: String(n), status: t.str('tagStatus') || 'active' })),
        }),
        pathParams: memberHash,
        extra: false,
      },
      {
        value: 'list.list',
        label: ['List audiences', 'Listar audiencias'],
        method: 'GET',
        path: '/lists',
        extra: false,
      },
      {
        value: 'campaign.list',
        label: ['List campaigns', 'Listar campañas'],
        method: 'GET',
        path: '/campaigns',
        fields: [f('status', 'Status')],
      },
      {
        value: 'campaign.send',
        label: ['Send campaign', 'Enviar campaña'],
        method: 'POST',
        path: '/campaigns/{campaignId}/actions/send',
        fields: [r('campaignId', 'Campaign id')],
        extra: false,
      },
    ],
  }),

  service({
    type: 'brevo',
    category: 'marketing',
    icon: 'Send',
    color: 'bg-teal-600',
    label: ['Brevo', 'Brevo'],
    description: [
      'Transactional email and SMS, contacts and lists',
      'Email y SMS transaccional, contactos y listas',
    ],
    auth: { kind: 'header', provider: 'brevo', header: 'api-key', label: 'API key' },
    base: 'https://api.brevo.com/v3',
    operations: [
      {
        value: 'email.send',
        label: ['Send email', 'Enviar email'],
        method: 'POST',
        path: '/smtp/email',
        fields: [
          r('to', 'To (email)', { in: 'none' }),
          r('senderEmail', 'From email', { key: 'sender.email' }),
          f('senderName', 'From name', { key: 'sender.name' }),
          r('subject', 'Subject'),
          r('htmlContent', 'HTML body', { rows: 5 }),
        ],
        body: (t, b) => ({ ...b, to: t.list('to').map(e => ({ email: String(e) })) }),
      },
      {
        value: 'sms.send',
        label: ['Send SMS', 'Enviar SMS'],
        method: 'POST',
        path: '/transactionalSMS/sms',
        fields: [
          r('sender', 'Sender'),
          r('recipient', 'Recipient (+…)'),
          r('content', 'Text', { rows: 3 }),
        ],
      },
      ...crud(
        'contact',
        { one: ['contact', 'contacto'], many: ['contacts', 'contactos'] },
        '/contacts',
        r('identifier', 'Email or id'),
        [
          f('email', 'Email'),
          f('attributes', 'Attributes (JSON)', { json: true, rows: 2 }),
          f('listIds', 'List ids', { list: true }),
        ],
        { updateMethod: 'PUT', listQuery: [f('limit', 'Limit', { type: 'number', in: 'query' })] }
      ),
      {
        value: 'list.list',
        label: ['List lists', 'Listar listas'],
        method: 'GET',
        path: '/contacts/lists',
        extra: false,
      },
    ],
  }),

  service({
    type: 'mailgun',
    category: 'marketing',
    icon: 'AtSign',
    color: 'bg-red-500',
    label: ['Mailgun', 'Mailgun'],
    description: [
      'Send email and check events and suppressions',
      'Enviar email y revisar eventos y supresiones',
    ],
    auth: { kind: 'basicSecret', provider: 'mailgun', user: 'api', label: 'API key' },
    base: {
      field: f('region', 'Region', {
        type: 'options',
        default: 'us',
        options: [
          { name: 'US', value: 'us' },
          { name: 'EU', value: 'eu' },
        ],
      }),
      build: v => (v === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'),
    },
    bodyType: 'form',
    operations: [
      {
        value: 'message.send',
        label: ['Send email', 'Enviar email'],
        method: 'POST',
        path: '/{domain}/messages',
        fields: [
          r('domain', 'Sending domain'),
          r('from', 'From'),
          r('to', 'To'),
          r('subject', 'Subject'),
          f('text', 'Text body', { rows: 4 }),
          f('html', 'HTML body', { rows: 4 }),
        ],
      },
      {
        value: 'event.list',
        label: ['List events', 'Listar eventos'],
        method: 'GET',
        path: '/{domain}/events',
        fields: [
          r('domain', 'Sending domain'),
          f('event', 'Event', { description: 'delivered, failed, opened…' }),
          f('limit', 'Limit', { type: 'number' }),
        ],
      },
      {
        value: 'bounce.list',
        label: ['List bounces', 'Listar rebotes'],
        method: 'GET',
        path: '/{domain}/bounces',
        fields: [r('domain', 'Sending domain')],
        extra: false,
      },
    ],
  }),

  service({
    type: 'postmark',
    category: 'marketing',
    icon: 'Stamp',
    color: 'bg-yellow-500',
    label: ['Postmark', 'Postmark'],
    description: [
      'Transactional email, templates and bounces',
      'Email transaccional, plantillas y rebotes',
    ],
    auth: {
      kind: 'header',
      provider: 'postmark',
      header: 'X-Postmark-Server-Token',
      label: 'Server token',
    },
    base: 'https://api.postmarkapp.com',
    operations: [
      {
        value: 'email.send',
        label: ['Send email', 'Enviar email'],
        method: 'POST',
        path: '/email',
        fields: [
          r('From', 'From'),
          r('To', 'To'),
          r('Subject', 'Subject'),
          f('TextBody', 'Text body', { rows: 3 }),
          f('HtmlBody', 'HTML body', { rows: 3 }),
          f('MessageStream', 'Message stream', { default: 'outbound' }),
        ],
      },
      {
        value: 'email.template',
        label: ['Send with template', 'Enviar con plantilla'],
        method: 'POST',
        path: '/email/withTemplate',
        fields: [
          r('From', 'From'),
          r('To', 'To'),
          r('TemplateAlias', 'Template alias'),
          f('TemplateModel', 'Template model (JSON)', { json: true, rows: 3 }),
        ],
      },
      {
        value: 'bounce.list',
        label: ['List bounces', 'Listar rebotes'],
        method: 'GET',
        path: '/bounces',
        fields: [
          f('count', 'Count', { type: 'number', default: 50 }),
          f('offset', 'Offset', { type: 'number', default: 0 }),
        ],
      },
    ],
  }),

  service({
    type: 'mailerlite',
    category: 'marketing',
    icon: 'MailPlus',
    color: 'bg-green-500',
    label: ['MailerLite', 'MailerLite'],
    description: ['Subscribers and groups', 'Suscriptores y grupos'],
    auth: { kind: 'bearer', provider: 'mailerlite', label: 'API token' },
    base: 'https://connect.mailerlite.com/api',
    operations: [
      {
        value: 'subscriber.upsert',
        label: ['Create or update subscriber', 'Crear o actualizar suscriptor'],
        method: 'POST',
        path: '/subscribers',
        fields: [
          r('email', 'Email'),
          f('fields', 'Fields (JSON)', { json: true, rows: 2 }),
          f('groups', 'Group ids', { list: true }),
        ],
      },
      {
        value: 'subscriber.get',
        label: ['Get subscriber', 'Obtener suscriptor'],
        method: 'GET',
        path: '/subscribers/{subscriberId}',
        fields: [r('subscriberId', 'Email or id')],
        extra: false,
      },
      {
        value: 'subscriber.list',
        label: ['List subscribers', 'Listar suscriptores'],
        method: 'GET',
        path: '/subscribers',
        fields: [f('limit', 'Limit', { type: 'number' })],
      },
      {
        value: 'subscriber.delete',
        label: ['Delete subscriber', 'Eliminar suscriptor'],
        method: 'DELETE',
        path: '/subscribers/{subscriberId}',
        fields: [r('subscriberId', 'Subscriber id')],
        extra: false,
      },
      {
        value: 'group.assign',
        label: ['Add subscriber to group', 'Agregar suscriptor a grupo'],
        method: 'POST',
        path: '/subscribers/{subscriberId}/groups/{groupId}',
        fields: [r('subscriberId', 'Subscriber id'), r('groupId', 'Group id')],
        extra: false,
      },
      {
        value: 'group.list',
        label: ['List groups', 'Listar grupos'],
        method: 'GET',
        path: '/groups',
        extra: false,
      },
    ],
  }),

  service({
    type: 'kit',
    category: 'marketing',
    icon: 'Newspaper',
    color: 'bg-rose-500',
    label: ['Kit (ConvertKit)', 'Kit (ConvertKit)'],
    description: [
      'Subscribers, tags and forms (API v4)',
      'Suscriptores, etiquetas y formularios (API v4)',
    ],
    auth: { kind: 'header', provider: 'kit', header: 'X-Kit-Api-Key', label: 'API key' },
    base: 'https://api.kit.com/v4',
    operations: [
      {
        value: 'subscriber.create',
        label: ['Create subscriber', 'Crear suscriptor'],
        method: 'POST',
        path: '/subscribers',
        fields: [
          r('email_address', 'Email'),
          f('first_name', 'First name'),
          f('state', 'State', { default: 'active' }),
        ],
      },
      {
        value: 'subscriber.list',
        label: ['List subscribers', 'Listar suscriptores'],
        method: 'GET',
        path: '/subscribers',
        fields: [f('email_address', 'Email')],
      },
      {
        value: 'subscriber.tag',
        label: ['Tag subscriber', 'Etiquetar suscriptor'],
        method: 'POST',
        path: '/tags/{tagId}/subscribers',
        fields: [r('tagId', 'Tag id'), r('email_address', 'Email')],
      },
      {
        value: 'form.add',
        label: ['Add subscriber to form', 'Agregar suscriptor a formulario'],
        method: 'POST',
        path: '/forms/{formId}/subscribers',
        fields: [r('formId', 'Form id'), r('email_address', 'Email')],
      },
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
    type: 'klaviyo',
    category: 'marketing',
    icon: 'ChartNoAxesCombined',
    color: 'bg-neutral-900',
    label: ['Klaviyo', 'Klaviyo'],
    description: ['Profiles, lists and events', 'Perfiles, listas y eventos'],
    auth: {
      kind: 'header',
      provider: 'klaviyo',
      header: 'Authorization',
      prefix: 'Klaviyo-API-Key ',
      label: 'Private API key',
    },
    base: 'https://a.klaviyo.com/api',
    headers: {
      revision: '2024-07-15',
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    operations: [
      {
        value: 'profile.create',
        label: ['Create profile', 'Crear perfil'],
        method: 'POST',
        path: '/profiles',
        fields: [
          r('email', 'Email', { in: 'none' }),
          f('first_name', 'First name', { in: 'none' }),
          f('last_name', 'Last name', { in: 'none' }),
        ],
        body: t => ({
          data: {
            type: 'profile',
            attributes: {
              email: t.str('email'),
              first_name: t.str('first_name') || undefined,
              last_name: t.str('last_name') || undefined,
            },
          },
        }),
        extra: false,
      },
      {
        value: 'profile.list',
        label: ['List profiles', 'Listar perfiles'],
        method: 'GET',
        path: '/profiles',
        fields: [f('filter', 'Filter', { description: 'equals(email,"a@b.com")' })],
      },
      {
        value: 'list.add',
        label: ['Add profiles to list', 'Agregar perfiles a lista'],
        method: 'POST',
        path: '/lists/{listId}/relationships/profiles',
        fields: [
          r('listId', 'List id'),
          r('profileIds', 'Profile ids', { list: true, in: 'none' }),
        ],
        body: t => ({
          data: t.list('profileIds').map(id => ({ type: 'profile', id: String(id) })),
        }),
        extra: false,
      },
      {
        value: 'event.create',
        label: ['Track event', 'Registrar evento'],
        method: 'POST',
        path: '/events',
        fields: [
          r('metric', 'Metric name', { in: 'none' }),
          r('email', 'Profile email', { in: 'none' }),
          f('properties', 'Properties (JSON)', { json: true, rows: 3, in: 'none' }),
        ],
        body: t => ({
          data: {
            type: 'event',
            attributes: {
              metric: { data: { type: 'metric', attributes: { name: t.str('metric') } } },
              profile: { data: { type: 'profile', attributes: { email: t.str('email') } } },
              properties: t.json('properties', {}),
            },
          },
        }),
        extra: false,
      },
      {
        value: 'list.list',
        label: ['List lists', 'Listar listas'],
        method: 'GET',
        path: '/lists',
        extra: false,
      },
    ],
  }),

  service({
    type: 'customerio',
    category: 'marketing',
    icon: 'UserRoundCheck',
    color: 'bg-indigo-500',
    label: ['Customer.io', 'Customer.io'],
    description: [
      'Send transactional messages and broadcasts (App API)',
      'Enviar mensajes transaccionales y broadcasts (App API)',
    ],
    auth: { kind: 'bearer', provider: 'customerio', label: 'App API key' },
    base: {
      field: f('region', 'Region', {
        type: 'options',
        default: 'us',
        options: [
          { name: 'US', value: 'us' },
          { name: 'EU', value: 'eu' },
        ],
      }),
      build: v => (v === 'eu' ? 'https://api-eu.customer.io/v1' : 'https://api.customer.io/v1'),
    },
    operations: [
      {
        value: 'email.send',
        label: ['Send transactional email', 'Enviar email transaccional'],
        method: 'POST',
        path: '/send/email',
        fields: [
          r('transactional_message_id', 'Transactional message id'),
          r('to', 'To'),
          r('email', 'Customer email', { key: 'identifiers.email' }),
          f('message_data', 'Message data (JSON)', { json: true, rows: 3 }),
        ],
      },
      {
        value: 'broadcast.trigger',
        label: ['Trigger broadcast', 'Disparar broadcast'],
        method: 'POST',
        path: '/campaigns/{broadcastId}/triggers',
        fields: [
          r('broadcastId', 'Broadcast id'),
          f('data', 'Data (JSON)', { json: true, rows: 3 }),
        ],
      },
      {
        value: 'customer.search',
        label: ['Find customers by email', 'Buscar clientes por email'],
        method: 'GET',
        path: '/customers',
        fields: [r('email', 'Email')],
        extra: false,
      },
    ],
  }),
];
