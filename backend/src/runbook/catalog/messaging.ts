import {
  apiNode,
  basic,
  baseUrl,
  type CatalogNode,
  type CatalogProperty,
  enc,
  MAIN,
} from './define';

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'messaging',
  icon,
  color: 'bg-violet-600',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const text = (displayName = 'Message', rows = 4): CatalogProperty => ({
  name: 'text',
  displayName,
  type: 'string',
  required: true,
  typeOptions: { rows, expression: true },
});

const webhookUrl: CatalogProperty = {
  name: 'webhookUrl',
  displayName: 'Webhook URL',
  type: 'secret',
  required: true,
  description: 'Treat it like a password: anyone with it can post.',
};

function httpsOnly(url: string): string | null {
  try {
    return new URL(url).protocol === 'https:' ? null : 'webhook URL must use https';
  } catch {
    return 'webhook URL is not a valid URL';
  }
}

export const MESSAGING_NODES: CatalogNode[] = [
  apiNode({
    ...meta(
      'slack.message',
      'Slack',
      ['Slack message', 'Mensaje de Slack'],
      [
        'Post to a channel or thread with a bot token (chat.postMessage)',
        'Publicar en un canal o hilo con un token de bot (chat.postMessage)',
      ]
    ),
    properties: [
      { name: 'token', displayName: 'Bot token (xoxb-…)', type: 'secret', required: true },
      {
        name: 'channel',
        displayName: 'Channel',
        type: 'string',
        required: true,
        description: 'Channel id (C0123…) or #name.',
      },
      text(),
      {
        name: 'threadTs',
        displayName: 'Reply in thread (ts)',
        type: 'string',
        description: 'e.g. {{steps.announce.output.ts}} to keep updates in one thread.',
        typeOptions: { expression: true },
      },
    ],
    request: t => ({
      method: 'POST',
      url: 'https://slack.com/api/chat.postMessage',
      headers: { Authorization: `Bearer ${t.str('token')}` },
      contentType: 'application/json; charset=utf-8',
      body: {
        channel: t.str('channel'),
        text: t.str('text'),
        ...(t.str('threadTs') ? { thread_ts: t.str('threadTs') } : {}),
      },
      describe: `Slack message to ${t.str('channel')}`,
    }),
    bodyError: body => {
      const b = body as { ok?: boolean; error?: string };
      return b?.ok === false ? (b.error ?? 'Slack returned ok: false') : null;
    },
    shape: (body, status) => {
      const b = (body ?? {}) as { ts?: string; channel?: string };
      return { status, ts: b.ts, channel: b.channel };
    },
  }),
  apiNode({
    ...meta(
      'mattermost.message',
      'MessageCircle',
      ['Mattermost message', 'Mensaje de Mattermost'],
      [
        'Post through a Mattermost incoming webhook',
        'Publicar mediante un webhook entrante de Mattermost',
      ]
    ),
    properties: [
      webhookUrl,
      text(),
      { name: 'channel', displayName: 'Channel override', type: 'string' },
      { name: 'username', displayName: 'Username override', type: 'string' },
    ],
    request: t => {
      const url = t.str('webhookUrl');
      const bad = httpsOnly(url);
      if (bad) return bad;
      return {
        method: 'POST',
        url,
        body: {
          text: t.str('text'),
          ...(t.str('channel') ? { channel: t.str('channel') } : {}),
          ...(t.str('username') ? { username: t.str('username') } : {}),
        },
        describe: 'Mattermost message',
      };
    },
  }),
  apiNode({
    ...meta(
      'googleChat.message',
      'MessagesSquare',
      ['Google Chat message', 'Mensaje de Google Chat'],
      [
        'Post to a Google Chat space through its webhook',
        'Publicar en un espacio de Google Chat mediante su webhook',
      ]
    ),
    properties: [webhookUrl, text()],
    request: t => {
      const url = t.str('webhookUrl');
      const bad = httpsOnly(url);
      if (bad) return bad;
      return {
        method: 'POST',
        url,
        body: { text: t.str('text') },
        describe: 'Google Chat message',
      };
    },
  }),
  apiNode({
    ...meta(
      'discord.message',
      'Gamepad2',
      ['Discord message', 'Mensaje de Discord'],
      [
        'Post to a Discord channel through its webhook',
        'Publicar en un canal de Discord mediante su webhook',
      ]
    ),
    properties: [
      webhookUrl,
      text(),
      { name: 'username', displayName: 'Username override', type: 'string' },
    ],
    request: t => {
      const url = t.str('webhookUrl');
      const bad = httpsOnly(url);
      if (bad) return bad;
      return {
        method: 'POST',
        url: `${url}${url.includes('?') ? '&' : '?'}wait=true`,
        body: {
          content: t.str('text').slice(0, 2000),
          ...(t.str('username') ? { username: t.str('username') } : {}),
        },
        describe: 'Discord message',
      };
    },
    shape: (body, status) => ({ status, messageId: (body as { id?: string })?.id }),
  }),
  apiNode({
    ...meta(
      'ntfy.publish',
      'BellDot',
      ['ntfy push', 'Push de ntfy'],
      [
        'Send a push notification to an ntfy topic (ntfy.sh or self-hosted)',
        'Enviar una notificación push a un tópico de ntfy (ntfy.sh o propio)',
      ]
    ),
    properties: [
      { name: 'server', displayName: 'Server', type: 'string', default: 'https://ntfy.sh' },
      { name: 'topic', displayName: 'Topic', type: 'string', required: true },
      text('Message', 3),
      { name: 'title', displayName: 'Title', type: 'string', typeOptions: { expression: true } },
      {
        name: 'priority',
        displayName: 'Priority',
        type: 'options',
        default: '3',
        options: [
          { name: 'Min', value: '1' },
          { name: 'Low', value: '2' },
          { name: 'Default', value: '3' },
          { name: 'High', value: '4' },
          { name: 'Urgent', value: '5' },
        ],
      },
      {
        name: 'tags',
        displayName: 'Tags',
        type: 'string',
        description: 'Comma-separated, e.g. warning,rotating_light',
      },
      {
        name: 'token',
        displayName: 'Access token',
        type: 'secret',
        description: 'Only for protected topics.',
      },
    ],
    request: t => ({
      method: 'POST',
      url: `${baseUrl(t.str('server'), 'server')}/${enc(t.str('topic'))}`,
      rawBody: t.str('text'),
      headers: {
        ...(t.str('title') ? { Title: t.str('title') } : {}),
        Priority: t.str('priority') || '3',
        ...(t.str('tags') ? { Tags: t.str('tags') } : {}),
        ...(t.str('token') ? { Authorization: `Bearer ${t.str('token')}` } : {}),
      },
      describe: `ntfy push to ${t.str('topic')}`,
    }),
    shape: (body, status) => ({ status, messageId: (body as { id?: string })?.id }),
  }),
  apiNode({
    ...meta(
      'twilio.sms',
      'Smartphone',
      ['Twilio SMS', 'SMS con Twilio'],
      ['Send a text message with Twilio', 'Enviar un SMS con Twilio']
    ),
    properties: [
      { name: 'accountSid', displayName: 'Account SID', type: 'string', required: true },
      { name: 'authToken', displayName: 'Auth token', type: 'secret', required: true },
      {
        name: 'from',
        displayName: 'From',
        type: 'string',
        required: true,
        description: 'Your Twilio number, e.g. +15551234567',
      },
      {
        name: 'to',
        displayName: 'To',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      text('Message', 3),
    ],
    request: t => {
      const sid = t.str('accountSid');
      if (!/^AC[0-9a-fA-F]{32}$/.test(sid))
        return 'accountSid must look like AC followed by 32 hex characters';
      return {
        method: 'POST',
        url: `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        headers: { Authorization: basic(sid, t.str('authToken')) },
        form: { From: t.str('from'), To: t.str('to'), Body: t.str('text') },
        describe: `SMS to ${t.str('to')}`,
      };
    },
    shape: (body, status) => {
      const b = (body ?? {}) as { sid?: string; status?: string };
      return { status, messageSid: b.sid, deliveryStatus: b.status };
    },
  }),
  apiNode({
    ...meta(
      'sendgrid.email',
      'Mail',
      ['SendGrid email', 'Email con SendGrid'],
      ['Send an email through SendGrid', 'Enviar un email con SendGrid']
    ),
    properties: [
      { name: 'apiKey', displayName: 'API key', type: 'secret', required: true },
      {
        name: 'from',
        displayName: 'From',
        type: 'string',
        required: true,
        description: 'A verified sender.',
      },
      {
        name: 'to',
        displayName: 'To',
        type: 'string',
        required: true,
        description: 'Comma-separated.',
        typeOptions: { expression: true },
      },
      {
        name: 'subject',
        displayName: 'Subject',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      text('Body', 6),
    ],
    request: t => {
      const to = t.list('to').map(e => ({ email: String(e) }));
      return {
        method: 'POST',
        url: 'https://api.sendgrid.com/v3/mail/send',
        headers: { Authorization: `Bearer ${t.str('apiKey')}` },
        body: {
          personalizations: [{ to }],
          from: { email: t.str('from') },
          subject: t.str('subject'),
          content: [{ type: 'text/plain', value: t.str('text') }],
        },
        describe: `SendGrid email to ${to.length} recipient(s) — ${t.str('subject').slice(0, 80)}`,
      };
    },
    shape: (_body, status) => ({ status, accepted: status === 202 }),
  }),
  apiNode({
    ...meta(
      'resend.email',
      'Send',
      ['Resend email', 'Email con Resend'],
      ['Send an email through Resend', 'Enviar un email con Resend']
    ),
    properties: [
      { name: 'apiKey', displayName: 'API key', type: 'secret', required: true },
      {
        name: 'from',
        displayName: 'From',
        type: 'string',
        required: true,
        description: 'e.g. Ops <ops@yourdomain.com>',
      },
      {
        name: 'to',
        displayName: 'To',
        type: 'string',
        required: true,
        description: 'Comma-separated.',
        typeOptions: { expression: true },
      },
      {
        name: 'subject',
        displayName: 'Subject',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      text('Body', 6),
    ],
    request: t => ({
      method: 'POST',
      url: 'https://api.resend.com/emails',
      headers: { Authorization: `Bearer ${t.str('apiKey')}` },
      body: {
        from: t.str('from'),
        to: t.list('to').map(String),
        subject: t.str('subject'),
        text: t.str('text'),
      },
      describe: `Resend email — ${t.str('subject').slice(0, 80)}`,
    }),
    shape: (body, status) => ({ status, id: (body as { id?: string })?.id }),
  }),
];
