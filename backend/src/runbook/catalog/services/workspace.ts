import type { CatalogNode, StepTools } from '../define';
import { f, r, service } from '../service';

/** RFC 2822 message, base64url — what Gmail's send endpoint expects. */
function rawEmail(t: StepTools): string {
  const lines = [
    `To: ${t.str('to')}`,
    ...(t.str('cc') ? [`Cc: ${t.str('cc')}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(t.str('subject')).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: ${t.bool('html') ? 'text/html' : 'text/plain'}; charset=UTF-8`,
    '',
    t.str('message'),
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

const googleAuth = { kind: 'bearer' as const, provider: 'google', label: 'OAuth access token' };
const msAuth = {
  kind: 'bearer' as const,
  provider: 'microsoft',
  label: 'Microsoft Graph access token',
};
const graph = 'https://graph.microsoft.com/v1.0';

export const WORKSPACE_NODES: CatalogNode[] = [
  service({
    type: 'googleCalendar',
    category: 'productivity',
    icon: 'CalendarDays',
    color: 'bg-blue-500',
    label: ['Google Calendar', 'Google Calendar'],
    description: ['Events, availability and calendars', 'Eventos, disponibilidad y calendarios'],
    auth: googleAuth,
    base: 'https://www.googleapis.com/calendar/v3',
    optionLoaders: { calendarId: { loader: 'google.calendars' } },
    operations: [
      {
        value: 'event.list',
        label: ['List events', 'Listar eventos'],
        method: 'GET',
        path: '/calendars/{calendarId}/events',
        fields: [
          r('calendarId', 'Calendar id', { default: 'primary' }),
          f('timeMin', 'From (ISO)'),
          f('timeMax', 'To (ISO)'),
          f('q', 'Search'),
          f('singleEvents', 'Expand recurring', { type: 'boolean', default: true }),
          f('maxResults', 'Max results', { type: 'number' }),
        ],
      },
      {
        value: 'event.create',
        label: ['Create event', 'Crear evento'],
        method: 'POST',
        path: '/calendars/{calendarId}/events',
        fields: [
          r('calendarId', 'Calendar id', { default: 'primary' }),
          r('summary', 'Title'),
          r('start', 'Start (ISO)', { key: 'start.dateTime' }),
          r('end', 'End (ISO)', { key: 'end.dateTime' }),
          f('description', 'Description', { rows: 2 }),
          f('location', 'Location'),
          f('attendees', 'Attendee emails', { list: true, in: 'none' }),
        ],
        body: (t, b) =>
          t.list('attendees').length
            ? { ...b, attendees: t.list('attendees').map(email => ({ email: String(email) })) }
            : b,
      },
      {
        value: 'event.get',
        label: ['Get event', 'Obtener evento'],
        method: 'GET',
        path: '/calendars/{calendarId}/events/{eventId}',
        fields: [r('calendarId', 'Calendar id', { default: 'primary' }), r('eventId', 'Event id')],
        extra: false,
      },
      {
        value: 'event.update',
        label: ['Update event', 'Actualizar evento'],
        method: 'PATCH',
        path: '/calendars/{calendarId}/events/{eventId}',
        fields: [
          r('calendarId', 'Calendar id', { default: 'primary' }),
          r('eventId', 'Event id'),
          f('summary', 'Title'),
          f('start', 'Start (ISO)', { key: 'start.dateTime' }),
          f('end', 'End (ISO)', { key: 'end.dateTime' }),
        ],
      },
      {
        value: 'event.delete',
        label: ['Delete event', 'Eliminar evento'],
        method: 'DELETE',
        path: '/calendars/{calendarId}/events/{eventId}',
        fields: [r('calendarId', 'Calendar id', { default: 'primary' }), r('eventId', 'Event id')],
        extra: false,
      },
      {
        value: 'freebusy',
        label: ['Check availability', 'Ver disponibilidad'],
        method: 'POST',
        path: '/freeBusy',
        fields: [
          r('timeMin', 'From (ISO)'),
          r('timeMax', 'To (ISO)'),
          r('calendars', 'Calendar ids', { list: true, in: 'none', default: 'primary' }),
        ],
        body: (t, b) => ({ ...b, items: t.list('calendars').map(id => ({ id: String(id) })) }),
      },
      {
        value: 'calendar.list',
        label: ['List calendars', 'Listar calendarios'],
        method: 'GET',
        path: '/users/me/calendarList',
        extra: false,
      },
    ],
  }),

  service({
    type: 'gmail',
    category: 'productivity',
    icon: 'Mail',
    color: 'bg-red-500',
    label: ['Gmail', 'Gmail'],
    description: [
      'Send, search, read, label and trash mail',
      'Enviar, buscar, leer, etiquetar y borrar correo',
    ],
    auth: googleAuth,
    base: 'https://gmail.googleapis.com/gmail/v1/users/me',
    operations: [
      {
        value: 'message.send',
        label: ['Send email', 'Enviar email'],
        method: 'POST',
        path: '/messages/send',
        fields: [
          r('to', 'To', { in: 'none' }),
          f('cc', 'Cc', { in: 'none' }),
          r('subject', 'Subject', { in: 'none' }),
          r('message', 'Body', { rows: 5, in: 'none' }),
          f('html', 'Body is HTML', { type: 'boolean', in: 'none' }),
          f('threadId', 'Reply in thread id'),
        ],
        body: (t, b) => ({ ...b, raw: rawEmail(t) }),
        extra: false,
      },
      {
        value: 'message.list',
        label: ['Search messages', 'Buscar mensajes'],
        method: 'GET',
        path: '/messages',
        fields: [
          f('q', 'Query', { description: 'Gmail search, e.g. from:alerts@ is:unread' }),
          f('maxResults', 'Max results', { type: 'number' }),
          f('labelIds', 'Label ids'),
        ],
      },
      {
        value: 'message.get',
        label: ['Get message', 'Obtener mensaje'],
        method: 'GET',
        path: '/messages/{messageId}',
        fields: [r('messageId', 'Message id'), f('format', 'Format', { default: 'full' })],
      },
      {
        value: 'message.modify',
        label: ['Add or remove labels', 'Agregar o quitar etiquetas'],
        method: 'POST',
        path: '/messages/{messageId}/modify',
        fields: [
          r('messageId', 'Message id'),
          f('addLabelIds', 'Add labels', { list: true }),
          f('removeLabelIds', 'Remove labels', {
            list: true,
            description: 'e.g. UNREAD to mark as read',
          }),
        ],
      },
      {
        value: 'message.trash',
        label: ['Move to trash', 'Mover a la papelera'],
        method: 'POST',
        path: '/messages/{messageId}/trash',
        fields: [r('messageId', 'Message id')],
        extra: false,
      },
      {
        value: 'draft.create',
        label: ['Create draft', 'Crear borrador'],
        method: 'POST',
        path: '/drafts',
        fields: [
          r('to', 'To', { in: 'none' }),
          f('cc', 'Cc', { in: 'none' }),
          r('subject', 'Subject', { in: 'none' }),
          r('message', 'Body', { rows: 5, in: 'none' }),
          f('html', 'Body is HTML', { type: 'boolean', in: 'none' }),
        ],
        body: t => ({ message: { raw: rawEmail(t) } }),
        extra: false,
      },
      {
        value: 'label.list',
        label: ['List labels', 'Listar etiquetas'],
        method: 'GET',
        path: '/labels',
        extra: false,
      },
    ],
  }),

  service({
    type: 'googleDrive',
    category: 'storage',
    icon: 'HardDrive',
    color: 'bg-yellow-500',
    label: ['Google Drive', 'Google Drive'],
    description: [
      'Search, create, copy, share and delete files and folders',
      'Buscar, crear, copiar, compartir y borrar archivos y carpetas',
    ],
    auth: googleAuth,
    base: 'https://www.googleapis.com/drive/v3',
    operations: [
      {
        value: 'file.list',
        label: ['Search files', 'Buscar archivos'],
        method: 'GET',
        path: '/files',
        fields: [
          f('q', 'Query', { description: "name contains 'report' and trashed = false" }),
          f('pageSize', 'Page size', { type: 'number' }),
          f('fields', 'Fields', { default: 'files(id,name,mimeType,modifiedTime,webViewLink)' }),
        ],
      },
      {
        value: 'file.get',
        label: ['Get file metadata', 'Obtener metadatos'],
        method: 'GET',
        path: '/files/{fileId}',
        fields: [
          r('fileId', 'File id'),
          f('fileFields', 'Fields', {
            key: 'fields',
            default: 'id,name,mimeType,modifiedTime,webViewLink',
          }),
        ],
      },
      {
        value: 'folder.create',
        label: ['Create folder', 'Crear carpeta'],
        method: 'POST',
        path: '/files',
        fields: [r('name', 'Name'), f('parents', 'Parent folder ids', { list: true })],
        body: (_t, b) => ({ ...b, mimeType: 'application/vnd.google-apps.folder' }),
      },
      {
        value: 'file.copy',
        label: ['Copy file', 'Copiar archivo'],
        method: 'POST',
        path: '/files/{fileId}/copy',
        fields: [
          r('fileId', 'File id'),
          f('name', 'New name'),
          f('parents', 'Parent folder ids', { list: true }),
        ],
      },
      {
        value: 'file.move',
        label: ['Move or rename file', 'Mover o renombrar archivo'],
        method: 'PATCH',
        path: '/files/{fileId}',
        fields: [
          r('fileId', 'File id'),
          f('name', 'New name'),
          f('addParents', 'Add to folder', { in: 'query' }),
          f('removeParents', 'Remove from folder', { in: 'query' }),
        ],
      },
      {
        value: 'file.share',
        label: ['Share file', 'Compartir archivo'],
        method: 'POST',
        path: '/files/{fileId}/permissions',
        fields: [
          r('fileId', 'File id'),
          r('role', 'Role', {
            type: 'options',
            default: 'reader',
            options: [
              { name: 'Reader', value: 'reader' },
              { name: 'Commenter', value: 'commenter' },
              { name: 'Writer', value: 'writer' },
            ],
          }),
          r('shareType', 'Type', {
            key: 'type',
            type: 'options',
            default: 'user',
            options: [
              { name: 'User', value: 'user' },
              { name: 'Group', value: 'group' },
              { name: 'Domain', value: 'domain' },
              { name: 'Anyone with link', value: 'anyone' },
            ],
          }),
          f('emailAddress', 'Email'),
        ],
      },
      {
        value: 'file.delete',
        label: ['Delete file', 'Eliminar archivo'],
        method: 'DELETE',
        path: '/files/{fileId}',
        fields: [r('fileId', 'File id')],
        extra: false,
      },
      {
        value: 'file.export',
        label: ['Export Google doc', 'Exportar documento de Google'],
        method: 'GET',
        path: '/files/{fileId}/export',
        fields: [r('fileId', 'File id'), r('mimeType', 'Format', { default: 'text/plain' })],
        extra: false,
      },
    ],
  }),

  service({
    type: 'googleDocs',
    category: 'productivity',
    icon: 'FileText',
    color: 'bg-blue-600',
    label: ['Google Docs', 'Google Docs'],
    description: [
      'Create documents, read them and insert or replace text',
      'Crear documentos, leerlos e insertar o reemplazar texto',
    ],
    auth: googleAuth,
    base: 'https://docs.googleapis.com/v1/documents',
    operations: [
      {
        value: 'document.create',
        label: ['Create document', 'Crear documento'],
        method: 'POST',
        path: '',
        fields: [r('title', 'Title')],
      },
      {
        value: 'document.get',
        label: ['Get document', 'Obtener documento'],
        method: 'GET',
        path: '/{documentId}',
        fields: [r('documentId', 'Document id')],
        extra: false,
      },
      {
        value: 'text.append',
        label: ['Append text', 'Agregar texto al final'],
        method: 'POST',
        path: '/{documentId}:batchUpdate',
        fields: [r('documentId', 'Document id'), r('text', 'Text', { rows: 4, in: 'none' })],
        body: t => ({
          requests: [{ insertText: { endOfSegmentLocation: {}, text: t.str('text') } }],
        }),
        extra: false,
      },
      {
        value: 'text.replace',
        label: ['Replace text', 'Reemplazar texto'],
        method: 'POST',
        path: '/{documentId}:batchUpdate',
        fields: [
          r('documentId', 'Document id'),
          r('find', 'Find', { in: 'none' }),
          r('replaceWith', 'Replace with', { in: 'none' }),
          f('matchCase', 'Match case', { type: 'boolean', in: 'none' }),
        ],
        body: t => ({
          requests: [
            {
              replaceAllText: {
                containsText: { text: t.str('find'), matchCase: t.bool('matchCase') },
                replaceText: t.str('replaceWith'),
              },
            },
          ],
        }),
        extra: false,
      },
    ],
  }),

  service({
    type: 'googleTasks',
    category: 'productivity',
    icon: 'ListChecks',
    color: 'bg-blue-500',
    label: ['Google Tasks', 'Google Tasks'],
    description: ['Tasks and task lists', 'Tareas y listas de tareas'],
    auth: googleAuth,
    base: 'https://tasks.googleapis.com/tasks/v1',
    operations: [
      {
        value: 'task.list',
        label: ['List tasks', 'Listar tareas'],
        method: 'GET',
        path: '/lists/{tasklist}/tasks',
        fields: [
          r('tasklist', 'Task list id', { default: '@default' }),
          f('showCompleted', 'Show completed', { type: 'boolean' }),
        ],
      },
      {
        value: 'task.create',
        label: ['Create task', 'Crear tarea'],
        method: 'POST',
        path: '/lists/{tasklist}/tasks',
        fields: [
          r('tasklist', 'Task list id', { default: '@default' }),
          r('title', 'Title'),
          f('notes', 'Notes', { rows: 2 }),
          f('due', 'Due (RFC 3339)'),
        ],
      },
      {
        value: 'task.complete',
        label: ['Complete task', 'Completar tarea'],
        method: 'PATCH',
        path: '/lists/{tasklist}/tasks/{taskId}',
        fields: [r('tasklist', 'Task list id', { default: '@default' }), r('taskId', 'Task id')],
        body: () => ({ status: 'completed' }),
        extra: false,
      },
      {
        value: 'task.delete',
        label: ['Delete task', 'Eliminar tarea'],
        method: 'DELETE',
        path: '/lists/{tasklist}/tasks/{taskId}',
        fields: [r('tasklist', 'Task list id', { default: '@default' }), r('taskId', 'Task id')],
        extra: false,
      },
      {
        value: 'tasklist.list',
        label: ['List task lists', 'Listar listas'],
        method: 'GET',
        path: '/users/@me/lists',
        extra: false,
      },
    ],
  }),

  service({
    type: 'googleContacts',
    category: 'productivity',
    icon: 'BookUser',
    color: 'bg-blue-500',
    label: ['Google Contacts', 'Google Contacts'],
    description: [
      'Search, create and list contacts (People API)',
      'Buscar, crear y listar contactos (People API)',
    ],
    auth: googleAuth,
    base: 'https://people.googleapis.com/v1',
    operations: [
      {
        value: 'contact.search',
        label: ['Search contacts', 'Buscar contactos'],
        method: 'GET',
        path: '/people:searchContacts',
        fields: [
          r('query', 'Query'),
          f('readMask', 'Fields', { default: 'names,emailAddresses,phoneNumbers' }),
        ],
      },
      {
        value: 'contact.list',
        label: ['List contacts', 'Listar contactos'],
        method: 'GET',
        path: '/people/me/connections',
        fields: [
          f('personFields', 'Fields', { default: 'names,emailAddresses,phoneNumbers' }),
          f('pageSize', 'Page size', { type: 'number' }),
        ],
      },
      {
        value: 'contact.create',
        label: ['Create contact', 'Crear contacto'],
        method: 'POST',
        path: '/people:createContact',
        fields: [
          r('givenName', 'First name', { in: 'none' }),
          f('familyName', 'Last name', { in: 'none' }),
          f('email', 'Email', { in: 'none' }),
          f('phone', 'Phone', { in: 'none' }),
        ],
        body: t => ({
          names: [{ givenName: t.str('givenName'), familyName: t.str('familyName') || undefined }],
          ...(t.str('email') ? { emailAddresses: [{ value: t.str('email') }] } : {}),
          ...(t.str('phone') ? { phoneNumbers: [{ value: t.str('phone') }] } : {}),
        }),
        extra: false,
      },
    ],
  }),

  service({
    type: 'youtube',
    category: 'productivity',
    icon: 'Youtube',
    color: 'bg-red-600',
    label: ['YouTube', 'YouTube'],
    description: [
      'Search videos and read channel and video details',
      'Buscar videos y leer detalles de canales y videos',
    ],
    auth: googleAuth,
    base: 'https://www.googleapis.com/youtube/v3',
    operations: [
      {
        value: 'search',
        label: ['Search', 'Buscar'],
        method: 'GET',
        path: '/search',
        fields: [
          r('q', 'Query'),
          f('part', 'Part', { default: 'snippet' }),
          f('type', 'Type', { default: 'video' }),
          f('maxResults', 'Max results', { type: 'number' }),
        ],
      },
      {
        value: 'video.get',
        label: ['Get videos', 'Obtener videos'],
        method: 'GET',
        path: '/videos',
        fields: [r('id', 'Video ids'), f('part', 'Part', { default: 'snippet' })],
      },
      {
        value: 'channel.get',
        label: ['Get channel', 'Obtener canal'],
        method: 'GET',
        path: '/channels',
        fields: [
          r('channelId', 'Channel ids', { key: 'id' }),
          f('part', 'Part', { default: 'snippet' }),
        ],
      },
    ],
  }),

  service({
    type: 'outlook',
    category: 'productivity',
    icon: 'Mail',
    color: 'bg-sky-700',
    label: ['Outlook', 'Outlook'],
    description: [
      'Send, search, read, move and flag mail (Microsoft Graph)',
      'Enviar, buscar, leer, mover y marcar correo (Microsoft Graph)',
    ],
    auth: msAuth,
    base: `${graph}/me`,
    operations: [
      {
        value: 'message.send',
        label: ['Send email', 'Enviar email'],
        method: 'POST',
        path: '/sendMail',
        fields: [
          r('to', 'To', { list: true, in: 'none' }),
          r('subject', 'Subject', { in: 'none' }),
          r('body', 'Body', { rows: 5, in: 'none' }),
          f('html', 'Body is HTML', { type: 'boolean', in: 'none' }),
        ],
        body: t => ({
          message: {
            subject: t.str('subject'),
            body: { contentType: t.bool('html') ? 'HTML' : 'Text', content: t.str('body') },
            toRecipients: t.list('to').map(a => ({ emailAddress: { address: String(a) } })),
          },
        }),
        extra: false,
      },
      {
        value: 'message.list',
        label: ['List messages', 'Listar mensajes'],
        method: 'GET',
        path: '/messages',
        fields: [
          f('$search', 'Search'),
          f('$filter', 'Filter', { description: 'isRead eq false' }),
          f('$top', 'Top', { type: 'number' }),
        ],
      },
      {
        value: 'message.get',
        label: ['Get message', 'Obtener mensaje'],
        method: 'GET',
        path: '/messages/{messageId}',
        fields: [r('messageId', 'Message id')],
        extra: false,
      },
      {
        value: 'message.reply',
        label: ['Reply', 'Responder'],
        method: 'POST',
        path: '/messages/{messageId}/reply',
        fields: [r('messageId', 'Message id'), r('comment', 'Reply', { rows: 4 })],
      },
      {
        value: 'message.move',
        label: ['Move to folder', 'Mover a carpeta'],
        method: 'POST',
        path: '/messages/{messageId}/move',
        fields: [
          r('messageId', 'Message id'),
          r('destinationId', 'Folder id or name', { description: 'e.g. archive, deleteditems' }),
        ],
      },
      {
        value: 'message.markRead',
        label: ['Mark as read', 'Marcar como leído'],
        method: 'PATCH',
        path: '/messages/{messageId}',
        fields: [r('messageId', 'Message id')],
        body: () => ({ isRead: true }),
        extra: false,
      },
      {
        value: 'folder.list',
        label: ['List folders', 'Listar carpetas'],
        method: 'GET',
        path: '/mailFolders',
        extra: false,
      },
    ],
  }),

  service({
    type: 'outlookCalendar',
    category: 'productivity',
    icon: 'CalendarRange',
    color: 'bg-sky-700',
    label: ['Outlook Calendar', 'Calendario de Outlook'],
    description: [
      'Events and Teams meetings (Microsoft Graph)',
      'Eventos y reuniones de Teams (Microsoft Graph)',
    ],
    auth: msAuth,
    base: `${graph}/me`,
    operations: [
      {
        value: 'event.list',
        label: ['List events in range', 'Listar eventos en un rango'],
        method: 'GET',
        path: '/calendarView',
        fields: [
          r('startDateTime', 'From (ISO)'),
          r('endDateTime', 'To (ISO)'),
          f('$top', 'Top', { type: 'number' }),
        ],
      },
      {
        value: 'event.create',
        label: ['Create event', 'Crear evento'],
        method: 'POST',
        path: '/events',
        fields: [
          r('subject', 'Title'),
          r('start', 'Start (ISO)', { key: 'start.dateTime' }),
          r('end', 'End (ISO)', { key: 'end.dateTime' }),
          f('timeZone', 'Time zone', { in: 'none', default: 'UTC' }),
          f('isOnlineMeeting', 'Teams meeting', { type: 'boolean' }),
          f('attendees', 'Attendee emails', { list: true, in: 'none' }),
        ],
        body: (t, b) => {
          const tz = t.str('timeZone') || 'UTC';
          return {
            ...b,
            start: { ...(b.start as object), timeZone: tz },
            end: { ...(b.end as object), timeZone: tz },
            ...(t.list('attendees').length
              ? {
                  attendees: t
                    .list('attendees')
                    .map(a => ({ emailAddress: { address: String(a) }, type: 'required' })),
                }
              : {}),
          };
        },
      },
      {
        value: 'event.delete',
        label: ['Delete event', 'Eliminar evento'],
        method: 'DELETE',
        path: '/events/{eventId}',
        fields: [r('eventId', 'Event id')],
        extra: false,
      },
    ],
  }),

  service({
    type: 'onedrive',
    category: 'storage',
    icon: 'Cloud',
    color: 'bg-sky-600',
    label: ['OneDrive', 'OneDrive'],
    description: [
      'Browse, search, share and delete files (Microsoft Graph)',
      'Explorar, buscar, compartir y borrar archivos (Microsoft Graph)',
    ],
    auth: msAuth,
    base: `${graph}/me/drive`,
    operations: [
      {
        value: 'folder.list',
        label: ['List folder', 'Listar carpeta'],
        method: 'GET',
        path: '/root:/{folderPath}:/children',
        fields: [r('folderPath', 'Folder path', { default: 'Documents' })],
        extra: false,
      },
      {
        value: 'item.search',
        label: ['Search', 'Buscar'],
        method: 'GET',
        path: "/root/search(q='{query}')",
        fields: [r('query', 'Query')],
        extra: false,
      },
      {
        value: 'item.get',
        label: ['Get item', 'Obtener elemento'],
        method: 'GET',
        path: '/items/{itemId}',
        fields: [r('itemId', 'Item id')],
        extra: false,
      },
      {
        value: 'folder.create',
        label: ['Create folder', 'Crear carpeta'],
        method: 'POST',
        path: '/items/{parentId}/children',
        fields: [r('parentId', 'Parent item id', { default: 'root' }), r('name', 'Name')],
        body: (_t, b) => ({ ...b, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
      },
      {
        value: 'item.share',
        label: ['Create share link', 'Crear enlace para compartir'],
        method: 'POST',
        path: '/items/{itemId}/createLink',
        fields: [
          r('itemId', 'Item id'),
          r('type', 'Type', { default: 'view' }),
          f('scope', 'Scope', { default: 'organization' }),
        ],
      },
      {
        value: 'item.delete',
        label: ['Delete item', 'Eliminar elemento'],
        method: 'DELETE',
        path: '/items/{itemId}',
        fields: [r('itemId', 'Item id')],
        extra: false,
      },
    ],
  }),

  service({
    type: 'microsoftTodo',
    category: 'productivity',
    icon: 'CheckSquare',
    color: 'bg-blue-600',
    label: ['Microsoft To Do', 'Microsoft To Do'],
    description: ['Tasks and lists (Microsoft Graph)', 'Tareas y listas (Microsoft Graph)'],
    auth: msAuth,
    base: `${graph}/me/todo`,
    operations: [
      {
        value: 'list.list',
        label: ['List task lists', 'Listar listas'],
        method: 'GET',
        path: '/lists',
        extra: false,
      },
      {
        value: 'task.list',
        label: ['List tasks', 'Listar tareas'],
        method: 'GET',
        path: '/lists/{listId}/tasks',
        fields: [
          r('listId', 'List id'),
          f('$filter', 'Filter', { description: "status ne 'completed'" }),
        ],
      },
      {
        value: 'task.create',
        label: ['Create task', 'Crear tarea'],
        method: 'POST',
        path: '/lists/{listId}/tasks',
        fields: [
          r('listId', 'List id'),
          r('title', 'Title'),
          f('importance', 'Importance', { default: 'normal' }),
        ],
      },
      {
        value: 'task.complete',
        label: ['Complete task', 'Completar tarea'],
        method: 'PATCH',
        path: '/lists/{listId}/tasks/{taskId}',
        fields: [r('listId', 'List id'), r('taskId', 'Task id')],
        body: () => ({ status: 'completed' }),
        extra: false,
      },
    ],
  }),

  service({
    type: 'microsoftTeams',
    category: 'messaging',
    icon: 'Users',
    color: 'bg-indigo-600',
    label: ['Microsoft Teams', 'Microsoft Teams'],
    description: [
      'Channel and chat messages, channels and teams (Microsoft Graph)',
      'Mensajes de canal y chat, canales y equipos (Microsoft Graph)',
    ],
    auth: msAuth,
    base: graph,
    optionLoaders: {
      teamId: { loader: 'microsoft.teams' },
      channelId: { loader: 'microsoft.channels', params: ['teamId'] },
    },
    operations: [
      {
        value: 'channel.message',
        label: ['Post to channel', 'Publicar en canal'],
        method: 'POST',
        path: '/teams/{teamId}/channels/{channelId}/messages',
        fields: [
          r('teamId', 'Team id'),
          r('channelId', 'Channel id'),
          r('content', 'Message', { rows: 4, key: 'body.content' }),
          f('contentType', 'Format', { key: 'body.contentType', default: 'text' }),
        ],
      },
      {
        value: 'channel.reply',
        label: ['Reply in channel thread', 'Responder en hilo del canal'],
        method: 'POST',
        path: '/teams/{teamId}/channels/{channelId}/messages/{messageId}/replies',
        fields: [
          r('teamId', 'Team id'),
          r('channelId', 'Channel id'),
          r('messageId', 'Message id'),
          r('content', 'Message', { rows: 4, key: 'body.content' }),
        ],
      },
      {
        value: 'chat.message',
        label: ['Send chat message', 'Enviar mensaje de chat'],
        method: 'POST',
        path: '/chats/{chatId}/messages',
        fields: [r('chatId', 'Chat id'), r('content', 'Message', { rows: 4, key: 'body.content' })],
      },
      {
        value: 'channel.list',
        label: ['List channels', 'Listar canales'],
        method: 'GET',
        path: '/teams/{teamId}/channels',
        fields: [r('teamId', 'Team id')],
        extra: false,
      },
      {
        value: 'channel.create',
        label: ['Create channel', 'Crear canal'],
        method: 'POST',
        path: '/teams/{teamId}/channels',
        fields: [r('teamId', 'Team id'), r('displayName', 'Name'), f('description', 'Description')],
      },
      {
        value: 'team.list',
        label: ['List my teams', 'Listar mis equipos'],
        method: 'GET',
        path: '/me/joinedTeams',
        extra: false,
      },
    ],
  }),
];
