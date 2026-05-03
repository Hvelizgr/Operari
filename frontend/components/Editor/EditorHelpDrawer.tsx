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
 * EditorHelpDrawer — slide-in cheat-sheet for the runbook editor.
 *
 * The runbook editor already has Templates, the property forms, and
 * the palette descriptions, so this drawer focuses on the parts an
 * operator can't easily figure out from the UI alone: how the
 * `{{vars.x}}` / `{{secrets.X}}` / `{{steps.<id>.output}}` template
 * languages compose, when control-flow steps (Loop / Switch /
 * operari.if / approval) actually pause vs. branch, what retry +
 * timeout fields buy you, and the failure-mode shortcuts that
 * separate "step has no parents" from "credentialId not in context.secrets."
 *
 * Drawer chrome lives in `components/help/HelpDrawer.tsx`; this file
 * supplies the runbook-specific topics + the step-type auto-detect
 * used to jump to the matching section when the operator opens the
 * drawer with a node selected.
 */

interface EditorHelpDrawerProps {
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
  initialTopicId?: string | null;
}

/**
 * Maps a step type to the most relevant help topic. Many types
 * share their "story" with a sibling (Loop and Switch are both
 * control-flow), so the map collapses families. Unknown types
 * return null and the drawer falls back to its default landing
 * topic.
 *
 * Exported so the editor canvas can pass `detectActiveStep(selected)`
 * straight into the drawer without rebuilding the mapping.
 */
export function detectActiveStep(stepType: string | null | undefined): string | null {
  if (!stepType) return null;
  switch (stepType) {
    case 'shell':
    case 'kubectl':
    case 'ssh':
    case 'operari.httpRequest':
    case 'http':
    case 'operari.database':
    case 'database':
      return 'steps';
    case 'Loop':
    case 'Iterator':
    case 'operari.loop':
    case 'Switch':
    case 'operari.if':
    case 'Condition':
      return 'control-flow';
    case 'approval':
    case 'wait':
    case 'Suspend':
      return 'pauses';
    case 'notify':
    case 'Email':
      return 'notifications';
    case 'runbook':
      return 'composition';
    default:
      return null;
  }
}

const buildEditorTopics = (lang: 'en' | 'es'): HelpTopic[] => {
  const Code = ({ children }: { children: string }) => <SyntaxBlock code={children} lang={lang} />;
  return [
    {
      id: 'steps',
      emoji: '🧱',
      label: { en: 'Step types', es: 'Tipos de step' },
      body: {
        en: (
          <>
            <HelpP>
              The palette groups step types by what they do. The ones you'll reach for most often:
            </HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>shell</HelpKW> — runs a command on the runner. Stdout becomes the output;
                non-zero exit fails the step (toggle <HelpKW>failOnNonZeroExit</HelpKW> when you
                actually want the exit code as data).
              </li>
              <li>
                <HelpKW>kubectl</HelpKW> — same shell envelope, but materialises a kubeconfig from a
                connected account into the runner's tempdir before the command runs.
              </li>
              <li>
                <HelpKW>ssh</HelpKW> — runs a command on a remote host. Reads its private key from{' '}
                <HelpKW>{`{{secrets.<credentialId>}}`}</HelpKW>; never paste keys into the config.
              </li>
              <li>
                <HelpKW>http</HelpKW> — fires an HTTP request and exposes status / headers / body
                downstream. Pairs with the API tester for authoring.
              </li>
              <li>
                <HelpKW>database</HelpKW> — executes SQL through a connected account. Read queries
                land their result rows on the output; writes return the affected count.
              </li>
              <li>
                <HelpKW>notify</HelpKW> — slack / email / etc. The channel id usually lives in a
                connected account, the message in the step config.
              </li>
              <li>
                <HelpKW>runbook</HelpKW> — calls another runbook as a sub-step. Useful for shared
                scaffolding (auth handshakes, common cleanups).
              </li>
            </ul>
          </>
        ),
        es: (
          <>
            <HelpP>
              El palette agrupa los step types por lo que hacen. Los que más vas a usar:
            </HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>shell</HelpKW> — corre un comando en el runner. Stdout se vuelve el output;
                exit code distinto de cero falla el step (toggle <HelpKW>failOnNonZeroExit</HelpKW>{' '}
                cuando querés tratar el exit code como dato).
              </li>
              <li>
                <HelpKW>kubectl</HelpKW> — el mismo envelope de shell pero materializa un kubeconfig
                desde un connected account al tempdir del runner antes de correr el comando.
              </li>
              <li>
                <HelpKW>ssh</HelpKW> — corre un comando en un host remoto. Lee la private key desde{' '}
                <HelpKW>{`{{secrets.<credentialId>}}`}</HelpKW>; nunca pegues keys en el config.
              </li>
              <li>
                <HelpKW>http</HelpKW> — dispara una request HTTP y expone status / headers / body
                downstream. Combiná con el API tester para autorearlo.
              </li>
              <li>
                <HelpKW>database</HelpKW> — ejecuta SQL a través de un connected account. Las
                queries de lectura aterrizan los rows en el output; los writes devuelven el count
                afectado.
              </li>
              <li>
                <HelpKW>notify</HelpKW> — slack / email / etc. El channel id vive en una connected
                account, el mensaje en el config del step.
              </li>
              <li>
                <HelpKW>runbook</HelpKW> — llama a otro runbook como sub-step. Útil para scaffolding
                compartido (handshakes de auth, cleanups comunes).
              </li>
            </ul>
          </>
        ),
      },
    },
    {
      id: 'templates',
      emoji: '✨',
      label: { en: 'Templates & vars', es: 'Templates y vars' },
      body: {
        en: (
          <>
            <HelpP>
              Three template channels feed step config at run time. The engine resolves them before
              the executor runs, so by the time your step gets the config every reference is already
              a plain string.
            </HelpP>
            <HelpP className="mt-2 font-semibold text-zinc-200">Inputs from the run dialog</HelpP>
            <Code>{`# config of an http step
url: https://api.example.com/orders/{{vars.orderId}}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">Connected-account secrets</HelpP>
            <Code>{`headers:
  Authorization: Bearer {{secrets.gh-cli-token}}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">Output of a previous step</HelpP>
            <Code>{`message: |
  Deploy {{steps.deploy.output.commit}} succeeded.
  See {{steps.deploy.output.url}} for logs.`}</Code>
            <HelpHint>
              <HelpKW>{`{{secrets.<id>}}`}</HelpKW> is audit-logged on every read — the dashboard
              shows which run consumed which secret. Inline strings (paste-the-token-in) bypass the
              audit chain entirely; that's the only thing the linter will refuse to save.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              Tres canales de templating alimentan el config de cada step en run time. El engine los
              resuelve antes de que el executor corra, así que cuando tu step recibe el config cada
              referencia ya es un string pelado.
            </HelpP>
            <HelpP className="mt-2 font-semibold text-zinc-200">Inputs del run dialog</HelpP>
            <Code>{`# config de un step http
url: https://api.example.com/orders/{{vars.orderId}}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">
              Secretos de connected accounts
            </HelpP>
            <Code>{`headers:
  Authorization: Bearer {{secrets.gh-cli-token}}`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">Output de un step anterior</HelpP>
            <Code>{`message: |
  Deploy {{steps.deploy.output.commit}} OK.
  Ver {{steps.deploy.output.url}} para los logs.`}</Code>
            <HelpHint>
              <HelpKW>{`{{secrets.<id>}}`}</HelpKW> queda audit-logged en cada lectura — el
              dashboard muestra qué run consumió qué secreto. Strings inline (pegar el token
              directo) saltean el audit chain entero; es la única cosa que el linter se rehúsa a
              guardar.
            </HelpHint>
          </>
        ),
      },
    },
    {
      id: 'control-flow',
      emoji: '🔀',
      label: { en: 'Control flow', es: 'Control flow' },
      body: {
        en: (
          <>
            <HelpP>
              Three steps decide what runs next. Their outputs feed the template channel above so
              downstream steps can branch on the decision.
            </HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>operari.if</HelpKW> — single boolean fork. Two output handles (
                <HelpKW>true</HelpKW> / <HelpKW>false</HelpKW>); only one fires.
              </li>
              <li>
                <HelpKW>Switch</HelpKW> — multi-way fork. Each case is an output handle; the engine
                picks the first that matches and skips the rest.
              </li>
              <li>
                <HelpKW>Loop</HelpKW> — fans out an array. Reads <HelpKW>itemsPath</HelpKW> (e.g.{' '}
                <HelpKW>vars.services</HelpKW>) or an inline <HelpKW>items</HelpKW> array, then runs
                the downstream chain once per item with{' '}
                <HelpKW>steps.&lt;loop&gt;.output.item</HelpKW> set.
              </li>
            </ul>
            <HelpHint>
              These are decisions, not loops with side effects. The actual work happens in the steps
              downstream; <HelpKW>Loop</HelpKW> in particular only normalises the items — the
              iteration is the engine's job.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              Tres steps deciden qué corre después. Sus outputs alimentan el canal de templating de
              arriba así los steps downstream pueden ramificar según la decisión.
            </HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>operari.if</HelpKW> — fork booleano simple. Dos output handles (
                <HelpKW>true</HelpKW> / <HelpKW>false</HelpKW>); solo uno dispara.
              </li>
              <li>
                <HelpKW>Switch</HelpKW> — fork multi-way. Cada case es un output handle; el engine
                elige el primero que matchea y saltea el resto.
              </li>
              <li>
                <HelpKW>Loop</HelpKW> — fanout de un array. Lee <HelpKW>itemsPath</HelpKW> (ej.{' '}
                <HelpKW>vars.services</HelpKW>) o un array <HelpKW>items</HelpKW> inline, después
                corre la cadena downstream una vez por item con{' '}
                <HelpKW>steps.&lt;loop&gt;.output.item</HelpKW> seteado.
              </li>
            </ul>
            <HelpHint>
              Estos son decisiones, no loops con side effects. El trabajo real pasa en los steps
              downstream; <HelpKW>Loop</HelpKW> en particular solo normaliza los items — la
              iteración la hace el engine.
            </HelpHint>
          </>
        ),
      },
    },
    {
      id: 'pauses',
      emoji: '⏸️',
      label: { en: 'Pauses & breakpoints', es: 'Pausas y breakpoints' },
      body: {
        en: (
          <>
            <HelpP>Pausing a run is a first-class concept. Three flavors:</HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>approval</HelpKW> — halts execution and posts to the approval inbox. The run
                stays <HelpKW>PAUSED</HelpKW> until a reviewer approves; downstream steps see the
                approver's input as the step output.
              </li>
              <li>
                <HelpKW>wait</HelpKW> — sleeps for a configured duration before continuing. No UI
                interaction.
              </li>
              <li>
                <HelpKW>Suspend</HelpKW> — programmatic pause. Used by sub-runbooks that need to
                wait for an external trigger to resume.
              </li>
            </ul>
            <HelpP className="mt-2">
              Breakpoints (Debug Option C) sit on top of this: any step can be marked as a
              breakpoint via the node toolbar, and the engine halts <em>before</em> executing it.
              The Continue button in the run console resumes through the same path.
            </HelpP>
            <HelpHint>
              A paused run holds connection-pool slots. Approvals that take days are fine;
              <HelpKW>wait</HelpKW> for hours is fine; but <HelpKW>wait</HelpKW> for weeks is
              probably a smell — split the runbook with a <HelpKW>runbook</HelpKW> step instead.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>Pausar un run es un concepto de primera clase. Tres sabores:</HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>approval</HelpKW> — detiene la ejecución y postea al inbox de aprobaciones.
                El run queda <HelpKW>PAUSED</HelpKW> hasta que un reviewer apruebe; los steps
                downstream reciben el input del aprobador como output del step.
              </li>
              <li>
                <HelpKW>wait</HelpKW> — duerme una duración configurada antes de seguir. Sin
                interacción de UI.
              </li>
              <li>
                <HelpKW>Suspend</HelpKW> — pausa programática. La usan sub-runbooks que esperan un
                trigger externo para seguir.
              </li>
            </ul>
            <HelpP className="mt-2">
              Los breakpoints (Debug Option C) van encima de esto: cualquier step se puede marcar
              como breakpoint desde el node toolbar, y el engine se detiene <em>antes</em> de
              ejecutarlo. El botón Continue en el run console reanuda por el mismo camino.
            </HelpP>
            <HelpHint>
              Un run pausado retiene slots del connection pool. Approvals que toman días están bien;{' '}
              <HelpKW>wait</HelpKW> de horas también; pero <HelpKW>wait</HelpKW> de semanas
              probablemente es un olor — partí el runbook con un step <HelpKW>runbook</HelpKW> en su
              lugar.
            </HelpHint>
          </>
        ),
      },
    },
    {
      id: 'retry-timeout',
      emoji: '🔁',
      label: { en: 'Retries & timeouts', es: 'Retries y timeouts' },
      body: {
        en: (
          <>
            <HelpP>
              Every step takes an optional <HelpKW>retryPolicy</HelpKW> and{' '}
              <HelpKW>timeoutSeconds</HelpKW> in its config. The engine handles the wiring;
              executors just see the post-retry result.
            </HelpP>
            <Code>{`retryPolicy:
  maxAttempts: 3
  backoff: exponential       # or "fixed" / "linear"
  initialDelayMs: 1000
  maxDelayMs: 30000
timeoutSeconds: 60`}</Code>
            <HelpHint>
              Don't stack retries on top of approvals or sub-runbooks — they're long-running by
              design and a retry storm there is just compounding latency. Reserve them for
              network-flaky steps (http, ssh, kubectl).
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              Cada step toma un <HelpKW>retryPolicy</HelpKW> y un <HelpKW>timeoutSeconds</HelpKW>{' '}
              opcionales en su config. El engine maneja el wiring; los executors solo ven el
              resultado post-retry.
            </HelpP>
            <Code>{`retryPolicy:
  maxAttempts: 3
  backoff: exponential       # o "fixed" / "linear"
  initialDelayMs: 1000
  maxDelayMs: 30000
timeoutSeconds: 60`}</Code>
            <HelpHint>
              No apiles retries arriba de approvals o sub-runbooks — son long-running por diseño y
              un retry storm ahí solo compone latencia. Reservalos para steps con red flaky (http,
              ssh, kubectl).
            </HelpHint>
          </>
        ),
      },
    },
    {
      id: 'composition',
      emoji: '🧩',
      label: { en: 'Sub-runbooks', es: 'Sub-runbooks' },
      body: {
        en: (
          <>
            <HelpP>
              The <HelpKW>runbook</HelpKW> step calls another runbook in this tenant as a single
              executable step. The parent waits or fires-and-forgets based on the{' '}
              <HelpKW>waitFor</HelpKW> field.
            </HelpP>
            <Code>{`type: runbook
config:
  runbookId: "<uuid-or-slug>"
  inputs:
    region: "{{vars.region}}"
  waitFor: sync          # or "async"
  timeoutSeconds: 600`}</Code>
            <HelpHint>
              Outputs of the sub-run land on <HelpKW>steps.&lt;name&gt;.output.subRun</HelpKW>.
              Cycles are caught at save time (the lineage page renders them so it's easy to see
              where the loop lives).
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              El step <HelpKW>runbook</HelpKW> llama a otro runbook del tenant como un step
              ejecutable. El padre espera o dispara-y-olvida según el campo <HelpKW>waitFor</HelpKW>
              .
            </HelpP>
            <Code>{`type: runbook
config:
  runbookId: "<uuid-o-slug>"
  inputs:
    region: "{{vars.region}}"
  waitFor: sync          # o "async"
  timeoutSeconds: 600`}</Code>
            <HelpHint>
              Los outputs del sub-run aterrizan en <HelpKW>steps.&lt;name&gt;.output.subRun</HelpKW>
              . Los ciclos se atrapan al guardar (la página de lineage los renderea, así que es
              fácil ver dónde vive el loop).
            </HelpHint>
          </>
        ),
      },
    },
    {
      id: 'notifications',
      emoji: '📣',
      label: { en: 'Notifications', es: 'Notificaciones' },
      body: {
        en: (
          <>
            <HelpP>
              <HelpKW>notify</HelpKW> + <HelpKW>Email</HelpKW> share a config shape. The channel
              (Slack channel id, email addresses) typically lives on the connected account so the
              runbook stays portable across envs.
            </HelpP>
            <Code>{`type: notify
config:
  channelCredentialId: "{{secrets.slack-prod}}"
  message: |
    *Deploy* of {{vars.service}} finished.
    Status: {{steps.deploy.output.status}}
    Duration: {{steps.deploy.output.durationMs}}ms`}</Code>
            <HelpHint>
              Notifications are best-effort. If you need "post-or-fail" semantics, gate the next
              step on the notify output instead of trusting it ran.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              <HelpKW>notify</HelpKW> + <HelpKW>Email</HelpKW> comparten shape de config. El channel
              (Slack channel id, direcciones de email) típicamente vive en el connected account así
              el runbook es portable entre envs.
            </HelpP>
            <Code>{`type: notify
config:
  channelCredentialId: "{{secrets.slack-prod}}"
  message: |
    *Deploy* de {{vars.service}} terminó.
    Estado: {{steps.deploy.output.status}}
    Duración: {{steps.deploy.output.durationMs}}ms`}</Code>
            <HelpHint>
              Las notificaciones son best-effort. Si necesitás semántica "post-o-falla", gateá el
              próximo step en el output del notify en vez de confiar en que corrió.
            </HelpHint>
          </>
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
              <HelpKW>credentialId "X" is not in context.secrets</HelpKW> — the step references a
              connected account that doesn't exist in this tenant, or the linter didn't pick it up.
              Re-save and check the Connections page.
            </li>
            <li>
              <HelpKW>step has no parents</HelpKW> — a non-trigger step needs at least one incoming
              edge. Wire it from a Trigger / Webhook / Schedule node.
            </li>
            <li>
              <HelpKW>onErrorRunbookId cannot reference the runbook itself</HelpKW> — error handlers
              must be a different runbook to avoid the obvious infinite loop.
            </li>
            <li>
              "Simulación" passes but real runs fail — the dry-run adapter short-circuits side
              effects on legacy executors. A real prod failure won't show up in a dry-run.
            </li>
            <li>
              YAML save drops your breakpoints — the YAML spec doesn't carry the field, so the
              autosave path falls back to JSON. Expected, not a bug.
            </li>
          </ul>
        ),
        es: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>
              <HelpKW>credentialId "X" is not in context.secrets</HelpKW> — el step referencia una
              connected account que no existe en este tenant, o el linter no la levantó. Re- guardá
              y chequeá la página de Connections.
            </li>
            <li>
              <HelpKW>step has no parents</HelpKW> — un step que no es trigger necesita al menos un
              edge entrante. Conectalo desde un Trigger / Webhook / Schedule.
            </li>
            <li>
              <HelpKW>onErrorRunbookId cannot reference the runbook itself</HelpKW> — los error
              handlers deben ser un runbook distinto para evitar el loop infinito obvio.
            </li>
            <li>
              "Simulación" pasa pero los runs reales fallan — el adapter de dry-run corta los side
              effects en los legacy executors. Un fallo real de prod no va a aparecer en un dry-run.
            </li>
            <li>
              Save por YAML pierde tus breakpoints — el spec YAML no carga el campo, así que el
              autosave cae al path JSON. Esperado, no es un bug.
            </li>
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
            <li>
              Reach for <HelpKW>{`{{secrets.<id>}}`}</HelpKW> over inline tokens — the audit chain
              depends on it.
            </li>
            <li>
              Keep step types narrow. <HelpKW>shell</HelpKW> with kubectl inline is a smell — use
              the native <HelpKW>kubectl</HelpKW> step so the kubeconfig handling is audited.
            </li>
            <li>
              Tag dangerous steps (<HelpKW>blast-radius: destructive</HelpKW> renders a red outline)
              and consider an <HelpKW>approval</HelpKW> gate upstream.
            </li>
            <li>
              Templates over hard-coded URLs/regions — use <HelpKW>{`{{vars.x}}`}</HelpKW> so the
              same runbook works across envs.
            </li>
            <li>
              Wire an <HelpKW>onErrorRunbookId</HelpKW> for runbooks that touch production — cleanup
              / rollback shouldn't be conditional on the operator remembering.
            </li>
            <li>
              Prefer Templates → Adapt → Save over starting from a blank canvas. The seeded
              templates encode the patterns the team already uses.
            </li>
          </ul>
        ),
        es: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>
              Mejor <HelpKW>{`{{secrets.<id>}}`}</HelpKW> que tokens inline — el audit chain depende
              de eso.
            </li>
            <li>
              Mantené los step types estrechos. <HelpKW>shell</HelpKW> con kubectl inline es un olor
              — usá el step nativo <HelpKW>kubectl</HelpKW> para que el handling del kubeconfig
              quede auditado.
            </li>
            <li>
              Tagueá los steps peligrosos (<HelpKW>blast-radius: destructive</HelpKW> rendea un
              outline rojo) y considerá un gate <HelpKW>approval</HelpKW> upstream.
            </li>
            <li>
              Templates por encima de URLs/regions hard-codeadas — usá{' '}
              <HelpKW>{`{{vars.x}}`}</HelpKW> para que el mismo runbook funcione entre envs.
            </li>
            <li>
              Wire-eá un <HelpKW>onErrorRunbookId</HelpKW> para runbooks que tocan producción —
              cleanup / rollback no debería depender de que el operador se acuerde.
            </li>
            <li>
              Mejor Templates → Adaptar → Guardar que arrancar desde un canvas en blanco. Los
              templates seedeados codifican los patrones que el equipo ya usa.
            </li>
          </ul>
        ),
      },
    },
  ];
};

export function EditorHelpDrawer({ open, onClose, lang, initialTopicId }: EditorHelpDrawerProps) {
  const topics = buildEditorTopics(lang);
  return (
    <HelpDrawer
      open={open}
      onClose={onClose}
      lang={lang}
      topics={topics}
      title={{ en: 'Runbook Help', es: 'Ayuda Runbook' }}
      subtitle={{ en: 'Editor cheatsheet', es: 'Cheatsheet del editor' }}
      initialTopicId={initialTopicId}
    />
  );
}
