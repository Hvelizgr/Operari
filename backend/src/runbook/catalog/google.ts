import jwt from 'jsonwebtoken';

import { type CatalogNode, enc, MAIN, ok, StepInputError, type StepTools } from './define';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function serviceAccount(t: StepTools): ServiceAccount {
  const sa = t.json<Partial<ServiceAccount>>('serviceAccount', {});
  if (!sa.client_email || !sa.private_key) {
    throw new StepInputError(
      'serviceAccount must be the JSON key file of a Google service account'
    );
  }
  return sa as ServiceAccount;
}

/** OAuth access token for a service account (JWT bearer grant). */
async function accessToken(t: StepTools, sa: ServiceAccount): Promise<string> {
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  if (!/^https:\/\/[a-z0-9.-]*googleapis\.com\//.test(tokenUri)) {
    throw new StepInputError('service account token_uri must be a googleapis.com URL');
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: sa.client_email, scope: SHEETS_SCOPE, aud: tokenUri, iat: now, exp: now + 3600 },
    sa.private_key,
    { algorithm: 'RS256' }
  );
  const res = await t.fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(
      `Google token exchange failed: ${body.error_description ?? `HTTP ${res.status}`}`
    );
  }
  return body.access_token;
}

const sheets: CatalogNode = {
  type: 'google.sheets',
  category: 'productivity',
  icon: 'Sheet',
  color: 'bg-green-600',
  label: { en: 'Google Sheets', es: 'Google Sheets' },
  description: {
    en: 'Append rows to a sheet or read a range, with a service account',
    es: 'Agregar filas a una hoja o leer un rango, con una cuenta de servicio',
  },
  inputs: MAIN,
  outputs: MAIN,
  properties: [
    {
      name: 'serviceAccount',
      displayName: 'Service account key (JSON)',
      type: 'secret',
      required: true,
      description: 'Share the spreadsheet with the service account email.',
    },
    {
      name: 'spreadsheetId',
      displayName: 'Spreadsheet id',
      type: 'string',
      required: true,
      description: 'From the sheet URL: /d/<id>/',
    },
    {
      name: 'action',
      displayName: 'Action',
      type: 'options',
      default: 'append',
      options: [
        { name: 'Append rows', value: 'append' },
        { name: 'Read range', value: 'read' },
      ],
    },
    {
      name: 'range',
      displayName: 'Range',
      type: 'string',
      default: 'Sheet1!A1',
      description: 'e.g. Incidents!A:F',
    },
    {
      name: 'values',
      displayName: 'Rows (JSON)',
      type: 'string',
      required: true,
      description: 'One row ["a", 1] or several [["a", 1], ["b", 2]].',
      typeOptions: { rows: 3, expression: true },
      displayOptions: { show: { action: ['append'] } },
    },
  ],
  run: async t => {
    const sa = serviceAccount(t);
    const id = enc(t.str('spreadsheetId'));
    const range = enc(t.str('range') || 'Sheet1!A1');
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}`;
    if (t.context.dryRun) return ok({ dryRun: true, action: t.str('action') });
    const token = await accessToken(t, sa);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (t.str('action') === 'read') {
      const res = await t.fetch(base, { headers });
      const body = (await res.json().catch(() => ({}))) as {
        values?: unknown[][];
        range?: string;
        error?: { message?: string };
      };
      if (!res.ok)
        throw new Error(`Sheets read failed: ${body.error?.message ?? `HTTP ${res.status}`}`);
      return ok({ range: body.range, rows: body.values ?? [], count: body.values?.length ?? 0 });
    }
    const raw = t.json<unknown[]>('values', []);
    const rows = Array.isArray(raw[0]) ? (raw as unknown[][]) : [raw];
    const res = await t.fetch(
      `${base}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ values: rows }),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      updates?: { updatedRange?: string; updatedRows?: number };
      error?: { message?: string };
    };
    if (!res.ok)
      throw new Error(`Sheets append failed: ${body.error?.message ?? `HTTP ${res.status}`}`);
    return ok({
      updatedRange: body.updates?.updatedRange,
      updatedRows: body.updates?.updatedRows ?? rows.length,
    });
  },
};

export const GOOGLE_NODES: CatalogNode[] = [sheets];
