import type { CatalogNode } from '../define';
import { crud, f, r, service } from '../service';

const atlassianSite = r('site', 'Site', { description: 'acme for acme.atlassian.net' });
const atlassianAuth = (provider: 'jira' | 'confluence') => ({
  kind: 'basic' as const,
  provider,
  user: r('email', 'Account email'),
  label: 'API token',
});

export const PROJECT_NODES: CatalogNode[] = [
  service({
    type: 'jira',
    category: 'productivity',
    icon: 'Kanban',
    color: 'bg-blue-600',
    label: ['Jira', 'Jira'],
    description: [
      'Issues, comments, transitions and JQL search (Jira Cloud)',
      'Issues, comentarios, transiciones y búsqueda JQL (Jira Cloud)',
    ],
    auth: atlassianAuth('jira'),
    base: {
      field: atlassianSite,
      build: v => `https://${v.replace(/\.atlassian\.net.*$/, '')}.atlassian.net/rest/api/3`,
    },
    optionLoaders: { projectKey: { loader: 'jira.projects', params: ['site', 'email'] } },
    paginate: {
      ops: ['issue.search'],
      strategy: {
        kind: 'cursor',
        items: 'issues',
        next: 'nextPageToken',
        param: 'nextPageToken',
        pageSize: { param: 'maxResults', value: 100 },
      },
    },
    operations: [
      {
        value: 'issue.search',
        label: ['Search issues (JQL)', 'Buscar issues (JQL)'],
        method: 'POST',
        path: '/search/jql',
        fields: [
          r('jql', 'JQL', { rows: 2, default: 'project = OPS ORDER BY created DESC' }),
          f('maxResults', 'Max results', { type: 'number', default: 50 }),
          f('fields', 'Fields', { list: true, default: 'summary,status,assignee' }),
        ],
      },
      {
        value: 'issue.get',
        label: ['Get issue', 'Obtener issue'],
        method: 'GET',
        path: '/issue/{issueKey}',
        fields: [r('issueKey', 'Issue key')],
        extra: false,
      },
      {
        value: 'issue.create',
        label: ['Create issue', 'Crear issue'],
        method: 'POST',
        path: '/issue',
        fields: [
          r('projectKey', 'Project key', { key: 'fields.project.key' }),
          r('summary', 'Summary', { key: 'fields.summary' }),
          r('issueType', 'Issue type', { key: 'fields.issuetype.name', default: 'Task' }),
          f('description', 'Description', { rows: 3, in: 'none' }),
          f('labels', 'Labels', { list: true, key: 'fields.labels' }),
        ],
        body: (t, b) => {
          const text = t.str('description');
          if (!text) return b;
          const fields = (b.fields ?? {}) as Record<string, unknown>;
          return {
            ...b,
            fields: {
              ...fields,
              description: {
                type: 'doc',
                version: 1,
                content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
              },
            },
          };
        },
      },
      {
        value: 'issue.update',
        label: ['Update issue', 'Actualizar issue'],
        method: 'PUT',
        path: '/issue/{issueKey}',
        fields: [
          r('issueKey', 'Issue key'),
          f('summary', 'Summary', { key: 'fields.summary' }),
          f('labels', 'Labels', { list: true, key: 'fields.labels' }),
        ],
      },
      {
        value: 'issue.delete',
        label: ['Delete issue', 'Eliminar issue'],
        method: 'DELETE',
        path: '/issue/{issueKey}',
        fields: [r('issueKey', 'Issue key')],
        extra: false,
      },
      {
        value: 'issue.transitions',
        label: ['List transitions', 'Listar transiciones'],
        method: 'GET',
        path: '/issue/{issueKey}/transitions',
        fields: [r('issueKey', 'Issue key')],
        extra: false,
      },
      {
        value: 'issue.transition',
        label: ['Transition issue', 'Cambiar estado del issue'],
        method: 'POST',
        path: '/issue/{issueKey}/transitions',
        fields: [
          r('issueKey', 'Issue key'),
          r('transitionId', 'Transition id', { key: 'transition.id' }),
        ],
      },
      {
        value: 'issue.assign',
        label: ['Assign issue', 'Asignar issue'],
        method: 'PUT',
        path: '/issue/{issueKey}/assignee',
        fields: [r('issueKey', 'Issue key'), r('accountId', 'Assignee account id')],
      },
      {
        value: 'comment.add',
        label: ['Add comment', 'Agregar comentario'],
        method: 'POST',
        path: '/issue/{issueKey}/comment',
        fields: [r('issueKey', 'Issue key'), r('comment', 'Comment', { rows: 3, in: 'none' })],
        body: t => ({
          body: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: t.str('comment') }] }],
          },
        }),
        extra: false,
      },
      {
        value: 'comment.list',
        label: ['List comments', 'Listar comentarios'],
        method: 'GET',
        path: '/issue/{issueKey}/comment',
        fields: [r('issueKey', 'Issue key')],
        extra: false,
      },
      {
        value: 'user.search',
        label: ['Find user', 'Buscar usuario'],
        method: 'GET',
        path: '/user/search',
        fields: [r('query', 'Email or name')],
        extra: false,
      },
      {
        value: 'project.list',
        label: ['List projects', 'Listar proyectos'],
        method: 'GET',
        path: '/project/search',
        extra: false,
      },
    ],
  }),

  service({
    type: 'confluence',
    category: 'productivity',
    icon: 'BookOpenText',
    color: 'bg-blue-700',
    label: ['Confluence', 'Confluence'],
    description: [
      'Pages and spaces (Confluence Cloud v2)',
      'Páginas y espacios (Confluence Cloud v2)',
    ],
    auth: atlassianAuth('confluence'),
    base: {
      field: atlassianSite,
      build: v => `https://${v.replace(/\.atlassian\.net.*$/, '')}.atlassian.net/wiki/api/v2`,
    },
    operations: [
      {
        value: 'page.create',
        label: ['Create page', 'Crear página'],
        method: 'POST',
        path: '/pages',
        fields: [
          r('spaceId', 'Space id'),
          r('title', 'Title'),
          f('parentId', 'Parent page id'),
          r('content', 'Body (storage HTML)', { rows: 5, key: 'body.value' }),
        ],
        body: (_t, b) => ({
          status: 'current',
          ...b,
          body: { representation: 'storage', ...(b.body as object) },
        }),
      },
      {
        value: 'page.get',
        label: ['Get page', 'Obtener página'],
        method: 'GET',
        path: '/pages/{pageId}',
        fields: [r('pageId', 'Page id'), f('body-format', 'Body format', { default: 'storage' })],
      },
      {
        value: 'page.update',
        label: ['Update page', 'Actualizar página'],
        method: 'PUT',
        path: '/pages/{pageId}',
        fields: [
          r('pageId', 'Page id'),
          r('title', 'Title'),
          r('content', 'Body (storage HTML)', { rows: 5, key: 'body.value' }),
          r('version', 'New version number', { type: 'number', key: 'version.number' }),
        ],
        body: (t, b) => ({
          id: t.str('pageId'),
          status: 'current',
          ...b,
          body: { representation: 'storage', ...(b.body as object) },
        }),
      },
      {
        value: 'page.delete',
        label: ['Delete page', 'Eliminar página'],
        method: 'DELETE',
        path: '/pages/{pageId}',
        fields: [r('pageId', 'Page id')],
        extra: false,
      },
      {
        value: 'page.list',
        label: ['List pages in space', 'Listar páginas del espacio'],
        method: 'GET',
        path: '/spaces/{spaceId}/pages',
        fields: [r('spaceId', 'Space id'), f('limit', 'Limit', { type: 'number' })],
      },
      {
        value: 'space.list',
        label: ['List spaces', 'Listar espacios'],
        method: 'GET',
        path: '/spaces',
        fields: [f('keys', 'Keys')],
      },
    ],
  }),

  service({
    type: 'todoist',
    category: 'productivity',
    icon: 'ListTodo',
    color: 'bg-red-500',
    label: ['Todoist', 'Todoist'],
    description: ['Tasks, projects and comments', 'Tareas, proyectos y comentarios'],
    auth: { kind: 'bearer', provider: 'todoist', label: 'API token' },
    base: 'https://api.todoist.com/rest/v2',
    operations: [
      ...crud(
        'task',
        { one: ['task', 'tarea'], many: ['tasks', 'tareas'] },
        '/tasks',
        r('taskId', 'Task id'),
        [
          f('content', 'Content'),
          f('description', 'Description', { rows: 2 }),
          f('project_id', 'Project id'),
          f('due_string', 'Due (natural language)', { description: 'tomorrow at 9am' }),
          f('priority', 'Priority (1-4)', { type: 'number' }),
          f('labels', 'Labels', { list: true }),
        ],
        {
          updateMethod: 'POST',
          listQuery: [
            f('project_id', 'Project id', { in: 'query' }),
            f('filter', 'Filter', { in: 'query' }),
          ],
        }
      ),
      {
        value: 'task.close',
        label: ['Complete task', 'Completar tarea'],
        method: 'POST',
        path: '/tasks/{taskId}/close',
        fields: [r('taskId', 'Task id')],
        extra: false,
      },
      {
        value: 'task.reopen',
        label: ['Reopen task', 'Reabrir tarea'],
        method: 'POST',
        path: '/tasks/{taskId}/reopen',
        fields: [r('taskId', 'Task id')],
        extra: false,
      },
      ...crud(
        'project',
        { one: ['project', 'proyecto'], many: ['projects', 'proyectos'] },
        '/projects',
        r('projectId', 'Project id'),
        [f('name', 'Name'), f('color', 'Color')],
        { updateMethod: 'POST' }
      ),
      {
        value: 'comment.add',
        label: ['Add comment', 'Agregar comentario'],
        method: 'POST',
        path: '/comments',
        fields: [r('task_id', 'Task id'), r('content', 'Comment', { rows: 3 })],
      },
    ],
  }),

  service({
    type: 'monday',
    category: 'productivity',
    icon: 'LayoutGrid',
    color: 'bg-pink-600',
    label: ['monday.com', 'monday.com'],
    description: [
      'Boards, items, updates and any GraphQL query',
      'Tableros, ítems, actualizaciones y cualquier consulta GraphQL',
    ],
    auth: { kind: 'header', provider: 'monday', header: 'Authorization', label: 'API token' },
    base: 'https://api.monday.com/v2',
    headers: { 'API-Version': '2024-10' },
    bodyError: b => {
      const e = (b as { errors?: Array<{ message?: string }>; error_message?: string })?.errors;
      return e?.length
        ? e.map(x => x.message).join('; ')
        : ((b as { error_message?: string })?.error_message ?? null);
    },
    operations: [
      {
        value: 'board.list',
        label: ['List boards', 'Listar tableros'],
        method: 'POST',
        path: '',
        extra: false,
        body: () => ({ query: 'query { boards (limit: 50) { id name state } }' }),
      },
      {
        value: 'item.list',
        label: ['List items of a board', 'Listar ítems de un tablero'],
        method: 'POST',
        path: '',
        extra: false,
        fields: [r('boardId', 'Board id', { in: 'none' })],
        body: t => ({
          query:
            'query ($b: [ID!]) { boards (ids: $b) { items_page (limit: 100) { items { id name column_values { id text } } } } }',
          variables: { b: [t.str('boardId')] },
        }),
      },
      {
        value: 'item.create',
        label: ['Create item', 'Crear ítem'],
        method: 'POST',
        path: '',
        extra: false,
        fields: [
          r('boardId', 'Board id', { in: 'none' }),
          r('itemName', 'Item name', { in: 'none' }),
          f('groupId', 'Group id', { in: 'none' }),
          f('columnValues', 'Column values (JSON)', { rows: 3, in: 'none' }),
        ],
        body: t => ({
          query:
            'mutation ($b: ID!, $n: String!, $g: String, $c: JSON) { create_item (board_id: $b, item_name: $n, group_id: $g, column_values: $c) { id } }',
          variables: {
            b: t.str('boardId'),
            n: t.str('itemName'),
            g: t.str('groupId') || undefined,
            c: t.str('columnValues') || undefined,
          },
        }),
      },
      {
        value: 'item.updateColumns',
        label: ['Update item columns', 'Actualizar columnas del ítem'],
        method: 'POST',
        path: '',
        extra: false,
        fields: [
          r('boardId', 'Board id', { in: 'none' }),
          r('itemId', 'Item id', { in: 'none' }),
          r('columnValues', 'Column values (JSON)', { rows: 3, in: 'none' }),
        ],
        body: t => ({
          query:
            'mutation ($b: ID!, $i: ID!, $c: JSON!) { change_multiple_column_values (board_id: $b, item_id: $i, column_values: $c) { id } }',
          variables: { b: t.str('boardId'), i: t.str('itemId'), c: t.str('columnValues') },
        }),
      },
      {
        value: 'update.create',
        label: ['Post an update on an item', 'Publicar una actualización en un ítem'],
        method: 'POST',
        path: '',
        extra: false,
        fields: [
          r('itemId', 'Item id', { in: 'none' }),
          r('text', 'Text', { rows: 3, in: 'none' }),
        ],
        body: t => ({
          query: 'mutation ($i: ID!, $t: String!) { create_update (item_id: $i, body: $t) { id } }',
          variables: { i: t.str('itemId'), t: t.str('text') },
        }),
      },
      {
        value: 'graphql',
        label: ['Run GraphQL', 'Ejecutar GraphQL'],
        method: 'POST',
        path: '',
        extra: false,
        fields: [
          r('query', 'Query', { rows: 5, in: 'none' }),
          f('variables', 'Variables (JSON)', { rows: 2, in: 'none' }),
        ],
        body: t => ({ query: t.str('query'), variables: t.json('variables', {}) }),
      },
    ],
  }),

  service({
    type: 'notion',
    category: 'productivity',
    icon: 'NotebookPen',
    color: 'bg-neutral-800',
    label: ['Notion', 'Notion'],
    description: [
      'Databases, pages, blocks, users and search',
      'Bases de datos, páginas, bloques, usuarios y búsqueda',
    ],
    auth: { kind: 'bearer', provider: 'notion', label: 'Integration secret' },
    base: 'https://api.notion.com/v1',
    headers: { 'Notion-Version': '2022-06-28' },
    optionLoaders: { databaseId: { loader: 'notion.databases' } },
    paginate: {
      ops: ['database.query', 'search', 'block.children', 'user.list'],
      strategy: {
        kind: 'cursor',
        items: 'results',
        next: 'next_cursor',
        param: 'start_cursor',
        pageSize: { param: 'page_size', value: 100 },
      },
    },
    operations: [
      {
        value: 'database.query',
        label: ['Query database', 'Consultar base de datos'],
        method: 'POST',
        path: '/databases/{databaseId}/query',
        fields: [
          r('databaseId', 'Database id'),
          f('filter', 'Filter (JSON)', { json: true, rows: 3 }),
          f('sorts', 'Sorts (JSON)', { json: true, rows: 2 }),
          f('page_size', 'Page size', { type: 'number' }),
        ],
      },
      {
        value: 'database.get',
        label: ['Get database', 'Obtener base de datos'],
        method: 'GET',
        path: '/databases/{databaseId}',
        fields: [r('databaseId', 'Database id')],
        extra: false,
      },
      {
        value: 'page.create',
        label: ['Create page in database', 'Crear página en base de datos'],
        method: 'POST',
        path: '/pages',
        fields: [
          r('databaseId', 'Database id', { key: 'parent.database_id' }),
          r('properties', 'Properties (JSON)', {
            json: true,
            rows: 5,
            description: '{"Name": {"title": [{"text": {"content": "Hi"}}]}}',
          }),
          f('children', 'Content blocks (JSON)', { json: true, rows: 3 }),
        ],
      },
      {
        value: 'page.get',
        label: ['Get page', 'Obtener página'],
        method: 'GET',
        path: '/pages/{pageId}',
        fields: [r('pageId', 'Page id')],
        extra: false,
      },
      {
        value: 'page.update',
        label: ['Update page properties', 'Actualizar propiedades de la página'],
        method: 'PATCH',
        path: '/pages/{pageId}',
        fields: [
          r('pageId', 'Page id'),
          f('properties', 'Properties (JSON)', { json: true, rows: 5 }),
          f('archived', 'Archive', { type: 'boolean' }),
        ],
      },
      {
        value: 'block.children',
        label: ['Get page content', 'Obtener contenido de la página'],
        method: 'GET',
        path: '/blocks/{blockId}/children',
        fields: [r('blockId', 'Page or block id'), f('page_size', 'Page size', { type: 'number' })],
      },
      {
        value: 'block.append',
        label: ['Append text to page', 'Agregar texto a la página'],
        method: 'PATCH',
        path: '/blocks/{blockId}/children',
        fields: [
          r('blockId', 'Page or block id'),
          r('text', 'Paragraph text', { rows: 3, in: 'none' }),
        ],
        body: t => ({
          children: t
            .str('text')
            .split(/\n{2,}/)
            .map(p => ({
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', text: { content: p } }] },
            })),
        }),
        extra: false,
      },
      {
        value: 'search',
        label: ['Search', 'Buscar'],
        method: 'POST',
        path: '/search',
        fields: [
          f('query', 'Query'),
          f('objectType', 'Only', {
            type: 'options',
            default: '',
            in: 'none',
            options: [
              { name: 'Everything', value: '' },
              { name: 'Pages', value: 'page' },
              { name: 'Databases', value: 'database' },
            ],
          }),
        ],
        body: (t, b) =>
          t.str('objectType')
            ? { ...b, filter: { property: 'object', value: t.str('objectType') } }
            : b,
      },
      {
        value: 'user.list',
        label: ['List users', 'Listar usuarios'],
        method: 'GET',
        path: '/users',
        extra: false,
      },
    ],
  }),

  service({
    type: 'coda',
    category: 'productivity',
    icon: 'FileSpreadsheet',
    color: 'bg-orange-600',
    label: ['Coda', 'Coda'],
    description: ['Tables, rows and formulas of a doc', 'Tablas, filas y fórmulas de un doc'],
    auth: { kind: 'bearer', provider: 'coda', label: 'API token' },
    base: 'https://coda.io/apis/v1',
    operations: [
      {
        value: 'row.list',
        label: ['List rows', 'Listar filas'],
        method: 'GET',
        path: '/docs/{docId}/tables/{tableId}/rows',
        fields: [
          r('docId', 'Doc id'),
          r('tableId', 'Table id or name'),
          f('query', 'Query', { description: '"Column":"value"' }),
          f('useColumnNames', 'Use column names', { type: 'boolean', default: true }),
        ],
      },
      {
        value: 'row.upsert',
        label: ['Insert or upsert rows', 'Insertar o actualizar filas'],
        method: 'POST',
        path: '/docs/{docId}/tables/{tableId}/rows',
        fields: [
          r('docId', 'Doc id'),
          r('tableId', 'Table id or name'),
          r('values', 'Row values (JSON object)', { json: true, rows: 3, in: 'none' }),
          f('keyColumns', 'Key columns', { list: true }),
        ],
        body: (t, b) => ({
          ...b,
          rows: [
            {
              cells: Object.entries(t.json<Record<string, unknown>>('values', {})).map(
                ([column, value]) => ({ column, value })
              ),
            },
          ],
        }),
      },
      {
        value: 'row.get',
        label: ['Get row', 'Obtener fila'],
        method: 'GET',
        path: '/docs/{docId}/tables/{tableId}/rows/{rowId}',
        fields: [
          r('docId', 'Doc id'),
          r('tableId', 'Table id or name'),
          r('rowId', 'Row id or name'),
        ],
        extra: false,
      },
      {
        value: 'row.delete',
        label: ['Delete row', 'Eliminar fila'],
        method: 'DELETE',
        path: '/docs/{docId}/tables/{tableId}/rows/{rowId}',
        fields: [
          r('docId', 'Doc id'),
          r('tableId', 'Table id or name'),
          r('rowId', 'Row id or name'),
        ],
        extra: false,
      },
      {
        value: 'table.list',
        label: ['List tables', 'Listar tablas'],
        method: 'GET',
        path: '/docs/{docId}/tables',
        fields: [r('docId', 'Doc id')],
        extra: false,
      },
      {
        value: 'formula.get',
        label: ['Get formula value', 'Obtener valor de fórmula'],
        method: 'GET',
        path: '/docs/{docId}/formulas/{formulaId}',
        fields: [r('docId', 'Doc id'), r('formulaId', 'Formula id or name')],
        extra: false,
      },
    ],
  }),

  service({
    type: 'baserow',
    category: 'productivity',
    icon: 'Sheet',
    color: 'bg-sky-600',
    label: ['Baserow', 'Baserow'],
    description: [
      'Rows of a table (cloud or self-hosted)',
      'Filas de una tabla (nube o self-hosted)',
    ],
    auth: {
      kind: 'header',
      provider: 'baserow',
      header: 'Authorization',
      prefix: 'Token ',
      label: 'Database token',
    },
    base: {
      field: f('host', 'Host', { default: 'https://api.baserow.io' }),
      build: v => `${(v || 'https://api.baserow.io').replace(/\/+$/, '')}/api/database/rows/table`,
    },
    operations: [
      {
        value: 'row.list',
        label: ['List rows', 'Listar filas'],
        method: 'GET',
        path: '/{tableId}/?user_field_names=true',
        fields: [
          r('tableId', 'Table id'),
          f('search', 'Search'),
          f('size', 'Page size', { type: 'number' }),
        ],
      },
      {
        value: 'row.get',
        label: ['Get row', 'Obtener fila'],
        method: 'GET',
        path: '/{tableId}/{rowId}/?user_field_names=true',
        fields: [r('tableId', 'Table id'), r('rowId', 'Row id')],
        extra: false,
      },
      {
        value: 'row.create',
        label: ['Create row', 'Crear fila'],
        method: 'POST',
        path: '/{tableId}/?user_field_names=true',
        fields: [
          r('tableId', 'Table id'),
          r('values', 'Values (JSON)', { json: true, rows: 3, in: 'none' }),
        ],
        body: t => t.json('values', {}),
        extra: false,
      },
      {
        value: 'row.update',
        label: ['Update row', 'Actualizar fila'],
        method: 'PATCH',
        path: '/{tableId}/{rowId}/?user_field_names=true',
        fields: [
          r('tableId', 'Table id'),
          r('rowId', 'Row id'),
          r('values', 'Values (JSON)', { json: true, rows: 3, in: 'none' }),
        ],
        body: t => t.json('values', {}),
        extra: false,
      },
      {
        value: 'row.delete',
        label: ['Delete row', 'Eliminar fila'],
        method: 'DELETE',
        path: '/{tableId}/{rowId}/',
        fields: [r('tableId', 'Table id'), r('rowId', 'Row id')],
        extra: false,
      },
    ],
  }),

  service({
    type: 'nocodb',
    category: 'productivity',
    icon: 'Database',
    color: 'bg-violet-600',
    label: ['NocoDB', 'NocoDB'],
    description: ['Records of a table (API v2)', 'Registros de una tabla (API v2)'],
    auth: { kind: 'header', provider: 'nocodb', header: 'xc-token', label: 'API token' },
    base: {
      field: f('host', 'Host', { default: 'https://app.nocodb.com' }),
      build: v => `${(v || 'https://app.nocodb.com').replace(/\/+$/, '')}/api/v2/tables`,
    },
    operations: [
      {
        value: 'record.list',
        label: ['List records', 'Listar registros'],
        method: 'GET',
        path: '/{tableId}/records',
        fields: [
          r('tableId', 'Table id'),
          f('where', 'Where', { description: '(Status,eq,Open)' }),
          f('limit', 'Limit', { type: 'number' }),
        ],
      },
      {
        value: 'record.get',
        label: ['Get record', 'Obtener registro'],
        method: 'GET',
        path: '/{tableId}/records/{recordId}',
        fields: [r('tableId', 'Table id'), r('recordId', 'Record id')],
        extra: false,
      },
      {
        value: 'record.create',
        label: ['Create record', 'Crear registro'],
        method: 'POST',
        path: '/{tableId}/records',
        fields: [
          r('tableId', 'Table id'),
          r('values', 'Values (JSON)', { json: true, rows: 3, in: 'none' }),
        ],
        body: t => t.json('values', {}),
        extra: false,
      },
      {
        value: 'record.update',
        label: ['Update record', 'Actualizar registro'],
        method: 'PATCH',
        path: '/{tableId}/records',
        fields: [
          r('tableId', 'Table id'),
          r('values', 'Values with Id (JSON)', { json: true, rows: 3, in: 'none' }),
        ],
        body: t => t.json('values', {}),
        extra: false,
      },
      {
        value: 'record.delete',
        label: ['Delete record', 'Eliminar registro'],
        method: 'DELETE',
        path: '/{tableId}/records',
        fields: [r('tableId', 'Table id'), r('recordId', 'Record id', { in: 'none' })],
        body: t => ({ Id: t.str('recordId') }),
        extra: false,
      },
    ],
  }),

  service({
    type: 'smartsheet',
    category: 'productivity',
    icon: 'Grid3x3',
    color: 'bg-blue-800',
    label: ['Smartsheet', 'Smartsheet'],
    description: ['Sheets and rows', 'Hojas y filas'],
    auth: { kind: 'bearer', provider: 'smartsheet', label: 'Access token' },
    base: 'https://api.smartsheet.com/2.0',
    operations: [
      {
        value: 'sheet.list',
        label: ['List sheets', 'Listar hojas'],
        method: 'GET',
        path: '/sheets',
        extra: false,
      },
      {
        value: 'sheet.get',
        label: ['Get sheet with rows', 'Obtener hoja con filas'],
        method: 'GET',
        path: '/sheets/{sheetId}',
        fields: [r('sheetId', 'Sheet id')],
        extra: false,
      },
      {
        value: 'row.add',
        label: ['Add rows', 'Agregar filas'],
        method: 'POST',
        path: '/sheets/{sheetId}/rows',
        fields: [
          r('sheetId', 'Sheet id'),
          r('rows', 'Rows (JSON array)', {
            json: true,
            rows: 4,
            in: 'none',
            description: '[{"toBottom": true, "cells": [{"columnId": 1, "value": "x"}]}]',
          }),
        ],
        body: t => t.json('rows', []),
        extra: false,
      },
      {
        value: 'row.update',
        label: ['Update rows', 'Actualizar filas'],
        method: 'PUT',
        path: '/sheets/{sheetId}/rows',
        fields: [
          r('sheetId', 'Sheet id'),
          r('rows', 'Rows (JSON array)', { json: true, rows: 4, in: 'none' }),
        ],
        body: t => t.json('rows', []),
        extra: false,
      },
      {
        value: 'row.delete',
        label: ['Delete rows', 'Eliminar filas'],
        method: 'DELETE',
        path: '/sheets/{sheetId}/rows',
        fields: [r('sheetId', 'Sheet id'), r('ids', 'Row ids', { list: true })],
        extra: false,
      },
    ],
  }),

  service({
    type: 'clockify',
    category: 'productivity',
    icon: 'Timer',
    color: 'bg-sky-500',
    label: ['Clockify', 'Clockify'],
    description: [
      'Time entries, projects and clients',
      'Registros de tiempo, proyectos y clientes',
    ],
    auth: { kind: 'header', provider: 'clockify', header: 'X-Api-Key', label: 'API key' },
    base: 'https://api.clockify.me/api/v1',
    operations: [
      {
        value: 'timeEntry.create',
        label: ['Create time entry', 'Crear registro de tiempo'],
        method: 'POST',
        path: '/workspaces/{workspaceId}/time-entries',
        fields: [
          r('workspaceId', 'Workspace id'),
          r('start', 'Start (ISO)'),
          f('end', 'End (ISO)'),
          f('description', 'Description'),
          f('projectId', 'Project id'),
        ],
      },
      {
        value: 'timeEntry.list',
        label: ['List time entries', 'Listar registros de tiempo'],
        method: 'GET',
        path: '/workspaces/{workspaceId}/user/{userId}/time-entries',
        fields: [
          r('workspaceId', 'Workspace id'),
          r('userId', 'User id'),
          f('start', 'From (ISO)'),
          f('end', 'To (ISO)'),
        ],
      },
      {
        value: 'project.list',
        label: ['List projects', 'Listar proyectos'],
        method: 'GET',
        path: '/workspaces/{workspaceId}/projects',
        fields: [r('workspaceId', 'Workspace id')],
        extra: false,
      },
      {
        value: 'project.create',
        label: ['Create project', 'Crear proyecto'],
        method: 'POST',
        path: '/workspaces/{workspaceId}/projects',
        fields: [r('workspaceId', 'Workspace id'), r('name', 'Name'), f('clientId', 'Client id')],
      },
      {
        value: 'client.list',
        label: ['List clients', 'Listar clientes'],
        method: 'GET',
        path: '/workspaces/{workspaceId}/clients',
        fields: [r('workspaceId', 'Workspace id')],
        extra: false,
      },
      {
        value: 'user.me',
        label: ['Current user', 'Usuario actual'],
        method: 'GET',
        path: '/user',
        extra: false,
      },
    ],
  }),

  service({
    type: 'harvest',
    category: 'productivity',
    icon: 'Clock',
    color: 'bg-orange-500',
    label: ['Harvest', 'Harvest'],
    description: [
      'Time entries, projects, clients and invoices',
      'Registros de tiempo, proyectos, clientes y facturas',
    ],
    auth: { kind: 'bearer', provider: 'harvest', label: 'Personal access token' },
    base: 'https://api.harvestapp.com/v2',
    headers: { 'User-Agent': 'Operari (https://operari.dev)' },
    headersFrom: t => ({ 'Harvest-Account-Id': t.str('accountId') }),
    operations: [
      {
        value: 'timeEntry.list',
        label: ['List time entries', 'Listar registros de tiempo'],
        method: 'GET',
        path: '/time_entries',
        fields: [
          r('accountId', 'Account id', { in: 'none' }),
          f('from', 'From (YYYY-MM-DD)'),
          f('to', 'To (YYYY-MM-DD)'),
        ],
      },
      {
        value: 'timeEntry.create',
        label: ['Create time entry', 'Crear registro de tiempo'],
        method: 'POST',
        path: '/time_entries',
        fields: [
          r('accountId', 'Account id', { in: 'none' }),
          r('project_id', 'Project id', { type: 'number' }),
          r('task_id', 'Task id', { type: 'number' }),
          r('spent_date', 'Date (YYYY-MM-DD)'),
          f('hours', 'Hours', { type: 'number' }),
          f('notes', 'Notes'),
        ],
      },
      {
        value: 'project.list',
        label: ['List projects', 'Listar proyectos'],
        method: 'GET',
        path: '/projects',
        fields: [r('accountId', 'Account id', { in: 'none' })],
        extra: false,
      },
      {
        value: 'client.list',
        label: ['List clients', 'Listar clientes'],
        method: 'GET',
        path: '/clients',
        fields: [r('accountId', 'Account id', { in: 'none' })],
        extra: false,
      },
      {
        value: 'invoice.list',
        label: ['List invoices', 'Listar facturas'],
        method: 'GET',
        path: '/invoices',
        fields: [r('accountId', 'Account id', { in: 'none' }), f('state', 'State')],
      },
    ],
  }),
];
