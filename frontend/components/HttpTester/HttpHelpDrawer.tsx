'use client';

import {
  HelpDrawer,
  HelpHint,
  HelpKW,
  HelpP,
  type HelpTopic,
  SyntaxBlock,
} from '../help/HelpDrawer';

/**
 * HttpHelpDrawer — slide-in cheat-sheet for the API tester.
 *
 * The same operators who hit the SQL drawer at 3 a.m. also debug
 * webhook callbacks and OAuth dances under pressure. This drawer
 * surfaces the verbs (GET / POST / PUT / DELETE / PATCH), the auth
 * patterns we expect (Bearer, Basic, the `{{secrets.<id>}}` template
 * the engine pre-resolves), the body shapes that explain "why is the
 * server returning 415", and the status-code groups that turn a wall
 * of red into a triage decision.
 *
 * Drawer chrome lives in `components/help/HelpDrawer.tsx`; this file
 * supplies the HTTP-specific topics + the method auto-detect used to
 * jump to the matching section on open.
 */

interface HttpHelpDrawerProps {
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
  onInsertSnippet?: (snippet: string) => void;
  initialTopicId?: string | null;
}

const KNOWN_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);

/**
 * Picks the topic id that matches the current request — used by
 * HttpTesterCanvas to auto-jump the drawer when opened. We prefer
 * `methods` over the verb's own section because the body of every
 * HTTP method help section lives inside the unified `methods` topic
 * (one section, with sub-headings); per-method jumps would mostly
 * add noise. Status-code triage is a separate top-level topic.
 */
export function detectActiveMethod(method: string | null | undefined): string | null {
  if (!method) return null;
  const upper = method.toUpperCase().trim();
  if (KNOWN_METHODS.has(upper)) return 'methods';
  return null;
}

const buildHttpTopics = (lang: 'en' | 'es', onInsert?: (s: string) => void): HelpTopic[] => {
  const Code = ({ children }: { children: string }) => (
    <SyntaxBlock code={children} onInsert={onInsert} lang={lang} />
  );
  return [
    {
      id: 'methods',
      emoji: '🔁',
      label: { en: 'HTTP methods', es: 'Métodos HTTP' },
      body: {
        en: (
          <>
            <HelpP>The verb tells the server what you want done. The big four:</HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>GET</HelpKW> — read. Idempotent + cacheable. No body.
              </li>
              <li>
                <HelpKW>POST</HelpKW> — create / submit. Body carries the payload. Not idempotent —
                retries can duplicate.
              </li>
              <li>
                <HelpKW>PUT</HelpKW> — replace the resource at this URL. Idempotent (same body =
                same end state).
              </li>
              <li>
                <HelpKW>PATCH</HelpKW> — partial update. Body describes the diff (RFC 7396 merge or
                RFC 6902 JSON Patch).
              </li>
              <li>
                <HelpKW>DELETE</HelpKW> — remove. Idempotent: deleting twice should leave the server
                in the same state (404 or 204 either way).
              </li>
            </ul>
            <HelpHint>
              "Idempotent" doesn't mean "safe to retry forever" — it means the server reaches the
              same end state. POST is the one that actually creates duplicates on retry; design the
              endpoint with an idempotency key when this matters.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>El verbo le dice al server qué querés hacer. Los cuatro grandes:</HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>GET</HelpKW> — leer. Idempotente y cacheable. Sin body.
              </li>
              <li>
                <HelpKW>POST</HelpKW> — crear / enviar. El body lleva el payload. No idempotente —
                los retries pueden duplicar.
              </li>
              <li>
                <HelpKW>PUT</HelpKW> — reemplazar el recurso en esa URL. Idempotente (mismo body =
                mismo estado final).
              </li>
              <li>
                <HelpKW>PATCH</HelpKW> — update parcial. El body describe el diff (RFC 7396 merge o
                RFC 6902 JSON Patch).
              </li>
              <li>
                <HelpKW>DELETE</HelpKW> — eliminar. Idempotente: borrar dos veces deja al server en
                el mismo estado (404 o 204).
              </li>
            </ul>
            <HelpHint>
              "Idempotente" no significa "seguro para retries infinitos" — significa que el server
              llega al mismo estado final. POST es el que duplica en retry; diseñá el endpoint con
              idempotency key cuando importe.
            </HelpHint>
          </>
        ),
      },
    },
    {
      id: 'status',
      emoji: '📟',
      label: { en: 'Status codes', es: 'Códigos de estado' },
      body: {
        en: (
          <>
            <HelpP>
              The first digit tells you what kind of response you got. Reach for that before parsing
              the body.
            </HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>2xx</HelpKW> — success. <HelpKW>200 OK</HelpKW>,{' '}
                <HelpKW>201 Created</HelpKW>, <HelpKW>204 No Content</HelpKW>.
              </li>
              <li>
                <HelpKW>3xx</HelpKW> — redirect. <HelpKW>301</HelpKW> permanent,{' '}
                <HelpKW>302/307</HelpKW> temporary, <HelpKW>304 Not Modified</HelpKW> for
                conditional GETs.
              </li>
              <li>
                <HelpKW>4xx</HelpKW> — your fault. <HelpKW>400</HelpKW> bad request,{' '}
                <HelpKW>401</HelpKW> not authenticated, <HelpKW>403</HelpKW> not authorized,{' '}
                <HelpKW>404</HelpKW> not found, <HelpKW>409</HelpKW> conflict, <HelpKW>422</HelpKW>{' '}
                validation, <HelpKW>429</HelpKW> rate-limited.
              </li>
              <li>
                <HelpKW>5xx</HelpKW> — their fault. <HelpKW>500</HelpKW> generic,{' '}
                <HelpKW>502/503/504</HelpKW> upstream gateway / unavailable / timeout. Retry with
                backoff is the right default.
              </li>
            </ul>
            <HelpHint>
              <HelpKW>401</HelpKW> vs. <HelpKW>403</HelpKW>: 401 means "I don't know who you are";
              403 means "I know who you are but you can't do this." Conflating them is a common auth
              bug.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              El primer dígito te dice qué tipo de respuesta es. Mirá eso antes de parsear el body.
            </HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>2xx</HelpKW> — éxito. <HelpKW>200 OK</HelpKW>, <HelpKW>201 Created</HelpKW>,{' '}
                <HelpKW>204 No Content</HelpKW>.
              </li>
              <li>
                <HelpKW>3xx</HelpKW> — redirect. <HelpKW>301</HelpKW> permanente,{' '}
                <HelpKW>302/307</HelpKW> temporal, <HelpKW>304 Not Modified</HelpKW> para GETs
                condicionales.
              </li>
              <li>
                <HelpKW>4xx</HelpKW> — tu culpa. <HelpKW>400</HelpKW> bad request,{' '}
                <HelpKW>401</HelpKW> sin autenticar, <HelpKW>403</HelpKW> sin autorizar,{' '}
                <HelpKW>404</HelpKW> no existe, <HelpKW>409</HelpKW> conflicto, <HelpKW>422</HelpKW>{' '}
                validación, <HelpKW>429</HelpKW> rate-limit.
              </li>
              <li>
                <HelpKW>5xx</HelpKW> — su culpa. <HelpKW>500</HelpKW> genérico,{' '}
                <HelpKW>502/503/504</HelpKW> upstream gateway / no disponible / timeout. Retry con
                backoff es el default sensato.
              </li>
            </ul>
            <HelpHint>
              <HelpKW>401</HelpKW> vs. <HelpKW>403</HelpKW>: 401 significa "no sé quién sos"; 403
              significa "sé quién sos pero no podés hacer esto". Confundirlos es un bug de auth
              clásico.
            </HelpHint>
          </>
        ),
      },
    },
    {
      id: 'auth',
      emoji: '🔑',
      label: { en: 'Authentication', es: 'Autenticación' },
      body: {
        en: (
          <>
            <HelpP>
              Three patterns cover ~95% of real APIs. Use the secrets vault — never paste raw tokens
              into a request.
            </HelpP>
            <HelpP className="mt-2 font-semibold text-zinc-200">Bearer (OAuth, API keys)</HelpP>
            <Code>{`Authorization: Bearer {{secrets.gh-cli-token}}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">Basic auth</HelpP>
            <Code>{`Authorization: Basic {{secrets.basic-creds-b64}}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">Custom header / cookie</HelpP>
            <Code>{`X-API-Key: {{secrets.datadog-key}}
Cookie: session={{secrets.session-id}}`}</Code>
            <HelpHint>
              The engine pre-resolves <HelpKW>{`{{secrets.<id>}}`}</HelpKW> templates at run time
              against your connected accounts. Outside a runbook (the live API tester), substitution
              still happens — the operator just needs the connected account scoped to their tenant.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              Tres patrones cubren ~95% de las APIs reales. Usá el vault de secretos — nunca pegues
              tokens crudos en una request.
            </HelpP>
            <HelpP className="mt-2 font-semibold text-zinc-200">Bearer (OAuth, API keys)</HelpP>
            <Code>{`Authorization: Bearer {{secrets.gh-cli-token}}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">Basic auth</HelpP>
            <Code>{`Authorization: Basic {{secrets.basic-creds-b64}}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">Header custom / cookie</HelpP>
            <Code>{`X-API-Key: {{secrets.datadog-key}}
Cookie: session={{secrets.session-id}}`}</Code>
            <HelpHint>
              El engine pre-resuelve <HelpKW>{`{{secrets.<id>}}`}</HelpKW> en tiempo de ejecución
              contra tus connected accounts. Fuera de un runbook (el API tester live), la
              sustitución también pasa — solo necesitás que la cuenta conectada esté scopeada al
              tenant.
            </HelpHint>
          </>
        ),
      },
    },
    {
      id: 'body',
      emoji: '📦',
      label: { en: 'Request body', es: 'Body de la request' },
      body: {
        en: (
          <>
            <HelpP>Two body shapes you'll see most of the time:</HelpP>
            <HelpP className="mt-2 font-semibold text-zinc-200">JSON (REST APIs)</HelpP>
            <Code>{`Content-Type: application/json

{
  "name": "Marta López",
  "email": "marta@correo.com",
  "active": true
}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">
              Form-urlencoded (HTML forms, OAuth token endpoints)
            </HelpP>
            <Code>{`Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=abc&client_secret=xyz`}</Code>
            <HelpHint>
              <HelpKW>415 Unsupported Media Type</HelpKW> almost always means a Content-Type
              mismatch. Check the API docs — Stripe wants form-urlencoded, GitHub wants JSON, and
              they look identical from the outside.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>Dos formas de body que vas a ver la mayoría del tiempo:</HelpP>
            <HelpP className="mt-2 font-semibold text-zinc-200">JSON (APIs REST)</HelpP>
            <Code>{`Content-Type: application/json

{
  "nombre": "Marta López",
  "email": "marta@correo.com",
  "activo": true
}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">
              Form-urlencoded (formularios HTML, endpoints OAuth)
            </HelpP>
            <Code>{`Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=abc&client_secret=xyz`}</Code>
            <HelpHint>
              <HelpKW>415 Unsupported Media Type</HelpKW> casi siempre es un mismatch de
              Content-Type. Chequeá los docs — Stripe quiere form-urlencoded, GitHub quiere JSON, y
              desde afuera se ven idénticos.
            </HelpHint>
          </>
        ),
      },
    },
    {
      id: 'headers',
      emoji: '🏷️',
      label: { en: 'Common headers', es: 'Headers comunes' },
      body: {
        en: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>
              <HelpKW>Accept</HelpKW> — what response shapes you'll handle.{' '}
              <HelpKW>application/json</HelpKW> is the safe default.
            </li>
            <li>
              <HelpKW>Content-Type</HelpKW> — what you're sending. Matches the body shape (see
              above).
            </li>
            <li>
              <HelpKW>Authorization</HelpKW> — see the auth section.
            </li>
            <li>
              <HelpKW>If-None-Match</HelpKW> / <HelpKW>If-Modified-Since</HelpKW> — conditional
              GETs; server can answer with <HelpKW>304</HelpKW> and skip the body.
            </li>
            <li>
              <HelpKW>X-Request-Id</HelpKW> — many APIs echo this back. Worth setting so you can
              correlate logs across systems.
            </li>
            <li>
              <HelpKW>User-Agent</HelpKW> — some APIs require it (GitHub) or rate-limit by it.
            </li>
          </ul>
        ),
        es: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>
              <HelpKW>Accept</HelpKW> — qué shapes de respuesta vas a manejar.{' '}
              <HelpKW>application/json</HelpKW> es el default seguro.
            </li>
            <li>
              <HelpKW>Content-Type</HelpKW> — qué estás mandando. Tiene que matchear con el body
              (ver arriba).
            </li>
            <li>
              <HelpKW>Authorization</HelpKW> — ver la sección de auth.
            </li>
            <li>
              <HelpKW>If-None-Match</HelpKW> / <HelpKW>If-Modified-Since</HelpKW> — GETs
              condicionales; el server puede responder <HelpKW>304</HelpKW> y saltearse el body.
            </li>
            <li>
              <HelpKW>X-Request-Id</HelpKW> — muchas APIs lo devuelven. Setearlo te permite correlar
              logs entre sistemas.
            </li>
            <li>
              <HelpKW>User-Agent</HelpKW> — algunas APIs lo requieren (GitHub) o rate-limitean por
              él.
            </li>
          </ul>
        ),
      },
    },
    {
      id: 'pitfalls',
      emoji: '⚠️',
      label: { en: 'Common errors', es: 'Errores comunes' },
      body: {
        en: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>
              CORS rejection from a browser-side test — the API tester runs server-side so this
              shouldn't bite, but watch out when migrating snippets to a SPA.
            </li>
            <li>Trailing slash mismatch — some APIs care, some don't. Try both.</li>
            <li>
              Sending JSON but forgetting <HelpKW>Content-Type: application/json</HelpKW>. Server
              parses as form, fields land empty.
            </li>
            <li>
              Following redirects silently — a <HelpKW>307</HelpKW> on a POST keeps the method; old
              clients downgrade to GET.
            </li>
            <li>
              Reading <HelpKW>200 OK</HelpKW> as success without checking the body — many APIs wrap
              errors in a 200 with <HelpKW>{`{ "error": ... }`}</HelpKW>.
            </li>
            <li>Treating timeouts as 5xx without backoff — you'll DoS yourself.</li>
          </ul>
        ),
        es: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>
              Rechazo de CORS desde un test del browser — el API tester corre del lado server así
              que esto no debería morder, pero ojo cuando migrás snippets a una SPA.
            </li>
            <li>
              Mismatch de trailing slash — a algunas APIs les importa, a otras no. Probá las dos.
            </li>
            <li>
              Mandar JSON pero olvidar <HelpKW>Content-Type: application/json</HelpKW>. El server
              parsea como form y los campos quedan vacíos.
            </li>
            <li>
              Seguir redirects sin chequear — un <HelpKW>307</HelpKW> en un POST mantiene el método;
              clientes viejos lo bajan a GET.
            </li>
            <li>
              Leer <HelpKW>200 OK</HelpKW> como éxito sin revisar el body — muchas APIs envuelven
              errores en un 200 con <HelpKW>{`{ "error": ... }`}</HelpKW>.
            </li>
            <li>Tratar timeouts como 5xx sin backoff — te DoSeás solo.</li>
          </ul>
        ),
      },
    },
    {
      id: 'best-practices',
      emoji: '✅',
      label: { en: 'Best practices', es: 'Buenas prácticas' },
      body: {
        en: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>Always set Accept and Content-Type explicitly.</li>
            <li>
              Reference secrets via <HelpKW>{`{{secrets.<id>}}`}</HelpKW>, never paste raw tokens.
            </li>
            <li>Set a meaningful X-Request-Id so logs across systems link up.</li>
            <li>
              Check the response status code first, body second. <HelpKW>response.ok</HelpKW> is
              true only for 2xx.
            </li>
            <li>Cap timeouts and use exponential backoff on 5xx / network errors.</li>
            <li>Pin a User-Agent so the upstream can identify your client in their logs.</li>
          </ul>
        ),
        es: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>Siempre setá Accept y Content-Type explícitos.</li>
            <li>
              Referenciá secretos con <HelpKW>{`{{secrets.<id>}}`}</HelpKW>, nunca pegues tokens
              crudos.
            </li>
            <li>Setá un X-Request-Id con sentido para que los logs entre sistemas se linkeen.</li>
            <li>
              Chequeá el status code primero, el body después. <HelpKW>response.ok</HelpKW> es true
              solo para 2xx.
            </li>
            <li>Cap-eá timeouts y usá backoff exponencial en 5xx / errores de red.</li>
            <li>Pin-eá un User-Agent para que el upstream pueda identificar tu cliente.</li>
          </ul>
        ),
      },
    },
  ];
};

export function HttpHelpDrawer({
  open,
  onClose,
  lang,
  onInsertSnippet,
  initialTopicId,
}: HttpHelpDrawerProps) {
  const topics = buildHttpTopics(lang, onInsertSnippet);
  return (
    <HelpDrawer
      open={open}
      onClose={onClose}
      lang={lang}
      topics={topics}
      title={{ en: 'API Help', es: 'Ayuda API' }}
      subtitle={{ en: 'HTTP request cheatsheet', es: 'Cheatsheet de requests HTTP' }}
      initialTopicId={initialTopicId}
    />
  );
}
