import { PrismaClient, Webhook } from '@prisma/client';
import crypto from 'crypto';

export interface CreatedWebhook extends Webhook {
  /** Full webhook URL — include in instructions to the user */
  url: string;
}

/**
 * Manages inbound webhooks. Each webhook is bound to a runbook + tenant
 * and has a unique URL token. External services (Sentry, Datadog, GitHub,
 * custom apps) POST to that URL to trigger the runbook.
 *
 * Optionally each webhook has a shared secret used for HMAC SHA-256
 * signature validation (recommended for production).
 */
export class WebhookService {
  constructor(private prisma: PrismaClient) {}

  async create(
    tenantId: string,
    runbookId: string,
    source: string,
    useSecret = true
  ): Promise<CreatedWebhook> {
    const token = crypto.randomBytes(24).toString('base64url');
    const secret = useSecret ? crypto.randomBytes(32).toString('base64url') : null;

    const webhook = await this.prisma.webhook.create({
      data: {
        tenantId,
        runbookId,
        source,
        token,
        secret,
        isActive: true,
      },
    });

    const baseUrl = process.env.APP_URL || 'http://localhost:4000';
    return {
      ...webhook,
      url: `${baseUrl}/api/webhooks/${token}`,
    };
  }

  async findByToken(token: string) {
    return this.prisma.webhook.findUnique({
      where: { token },
      include: { runbook: true },
    });
  }

  async list(tenantId: string) {
    const baseUrl = process.env.APP_URL || 'http://localhost:4000';
    const webhooks = await this.prisma.webhook.findMany({
      where: { tenantId },
      include: { runbook: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return webhooks.map(w => ({ ...w, url: `${baseUrl}/api/webhooks/${w.token}` }));
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.prisma.webhook.deleteMany({
      where: { id, tenantId },
    });
    return result.count > 0;
  }

  async recordTrigger(id: string) {
    return this.prisma.webhook.update({
      where: { id },
      data: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
      },
    });
  }

  /**
   * Validate HMAC SHA-256 signature for an incoming webhook request.
   *
   * **CRITICAL**: `rawBody` MUST be the exact bytes the sender signed.
   * `JSON.stringify(req.body)` is the wrong input — Express parses
   * the JSON before the route runs, and re-serializing produces
   * bytes that may differ from the original (key ordering, whitespace,
   * number precision, escaped characters). The canonical webhook
   * security bug. Capture the raw body via
   * `express.json({ verify: (req, _res, buf) => req.rawBody = buf })`
   * and pass `req.rawBody` here.
   *
   * Source-specific header formats:
   *   - GitHub:   X-Hub-Signature-256: sha256=<hex>
   *   - Sentry:   X-Sentry-Hook-Signature: <hex>
   *   - Datadog:  X-Datadog-Signature: <hex>
   *   - Generic:  X-Webhook-Signature: <hex>
   *
   * Stripe's `Stripe-Signature: t=...,v1=<hex>` is NOT handled here
   * because Stripe also requires a timestamp tolerance check against
   * replay attacks; that lives in a dedicated StripeSignatureVerifier
   * (deferred — when the billing integration ships).
   *
   * Returns false on missing header, missing source/secret, hex
   * decode failure, or signature mismatch. The boolean result is the
   * only signal — the caller logs and rejects the request.
   */
  verifySignature(
    secret: string,
    rawBody: Buffer | string | undefined,
    signatureHeader: string | undefined,
    _source: string
  ): boolean {
    if (!signatureHeader) return false;
    if (rawBody === undefined || rawBody === null) return false;

    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');

    const expected = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');

    let provided = signatureHeader.trim();

    // GitHub format: "sha256=<hex>". Strip the prefix before
    // comparing. The check is intentionally case-insensitive on
    // the prefix because GitHub's docs show lowercase but some
    // legacy senders capitalize it.
    if (provided.toLowerCase().startsWith('sha256=')) {
      provided = provided.substring(7);
    }

    // Both buffers must be the same length for timingSafeEqual to
    // run; otherwise it throws (which leaks length info via the
    // exception path). Pre-check the hex length and return false
    // on mismatch.
    if (expected.length !== provided.length) return false;

    try {
      return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Map an incoming webhook payload to runbook variables.
   * Different sources have different shapes — we normalize them.
   */
  mapPayloadToVariables(
    source: string,
    event: string | undefined,
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    switch (source) {
      case 'sentry':
        return this.parseSentryPayload(event, payload);

      case 'github':
        return this.parseGitHubPayload(event, payload);

      case 'datadog':
        return this.parseDatadogPayload(event, payload);

      default:
        return {
          source,
          event,
          payload,
        };
    }
  }

  /**
   * Deep-parse a GitHub webhook payload into structured runbook variables.
   *
   * Supports the most common events: push, pull_request, issues,
   * check_suite, workflow_run, release, and deployment. For unknown
   * events, returns a minimal envelope with the raw payload so the
   * runbook author can still access everything via {{vars.raw.*}}.
   *
   * Every parsed result includes `owner`, `repo`, and `head_sha` so
   * the GitHubStatusService can post commit statuses without the
   * runbook having to extract those itself.
   */
  private parseGitHubPayload(
    event: string | undefined,
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    const repoObj = payload.repository as Record<string, unknown> | undefined;
    const senderObj = payload.sender as Record<string, unknown> | undefined;

    const fullName = (repoObj?.full_name as string) ?? '';
    const [owner, repo] = fullName.includes('/') ? fullName.split('/') : [fullName, ''];

    const base: Record<string, unknown> = {
      source: 'github',
      event:
        event ?? (payload['action'] ? `${event ?? 'unknown'}.${payload['action']}` : 'unknown'),
      action: payload.action,
      owner,
      repo,
      repository: fullName,
      sender: senderObj?.login,
      sender_avatar: senderObj?.avatar_url,
    };

    switch (event) {
      case 'push': {
        const headCommit = payload.head_commit as Record<string, unknown> | undefined;
        const commits = payload.commits as Array<Record<string, unknown>> | undefined;
        return {
          ...base,
          ref: payload.ref,
          branch:
            typeof payload.ref === 'string' ? payload.ref.replace('refs/heads/', '') : undefined,
          head_sha: headCommit?.id ?? payload.after,
          before: payload.before,
          after: payload.after,
          pusher: (payload.pusher as Record<string, unknown>)?.name,
          forced: payload.forced,
          created: payload.created,
          deleted: payload.deleted,
          commit_message: headCommit?.message,
          commit_url: headCommit?.url,
          commit_author: (headCommit?.author as Record<string, unknown>)?.name,
          commit_count: commits?.length ?? 0,
          commits: commits?.map(c => ({
            id: c.id,
            message: c.message,
            author: (c.author as Record<string, unknown>)?.name,
            url: c.url,
            added: c.added,
            modified: c.modified,
            removed: c.removed,
          })),
          compare_url: payload.compare,
          raw: payload,
        };
      }

      case 'pull_request': {
        const pr = payload.pull_request as Record<string, unknown> | undefined;
        const headObj = pr?.head as Record<string, unknown> | undefined;
        const baseObj = pr?.base as Record<string, unknown> | undefined;
        const labels = pr?.labels as Array<Record<string, unknown>> | undefined;
        return {
          ...base,
          pr_number: payload.number,
          pr_title: pr?.title,
          pr_body: pr?.body,
          pr_state: pr?.state,
          pr_url: pr?.html_url,
          pr_draft: pr?.draft,
          pr_merged: pr?.merged,
          pr_mergeable: pr?.mergeable,
          head_sha: headObj?.sha,
          head_ref: headObj?.ref,
          head_label: headObj?.label,
          base_ref: baseObj?.ref,
          base_sha: baseObj?.sha,
          labels: labels?.map(l => l.name),
          additions: pr?.additions,
          deletions: pr?.deletions,
          changed_files: pr?.changed_files,
          raw: payload,
        };
      }

      case 'issues': {
        const issue = payload.issue as Record<string, unknown> | undefined;
        const labels = issue?.labels as Array<Record<string, unknown>> | undefined;
        return {
          ...base,
          issue_number: issue?.number,
          issue_title: issue?.title,
          issue_body: issue?.body,
          issue_state: issue?.state,
          issue_url: issue?.html_url,
          labels: labels?.map(l => l.name),
          head_sha: undefined,
          raw: payload,
        };
      }

      case 'check_suite': {
        const suite = payload.check_suite as Record<string, unknown> | undefined;
        return {
          ...base,
          head_sha: suite?.head_sha,
          head_branch: suite?.head_branch,
          conclusion: suite?.conclusion,
          status: suite?.status,
          raw: payload,
        };
      }

      case 'workflow_run': {
        const run = payload.workflow_run as Record<string, unknown> | undefined;
        return {
          ...base,
          workflow_name: run?.name,
          head_sha: run?.head_sha,
          head_branch: run?.head_branch,
          conclusion: run?.conclusion,
          status: run?.status,
          run_url: run?.html_url,
          raw: payload,
        };
      }

      case 'release': {
        const release = payload.release as Record<string, unknown> | undefined;
        return {
          ...base,
          tag_name: release?.tag_name,
          release_name: release?.name,
          release_body: release?.body,
          prerelease: release?.prerelease,
          draft: release?.draft,
          release_url: release?.html_url,
          head_sha: release?.target_commitish,
          raw: payload,
        };
      }

      case 'deployment':
      case 'deployment_status': {
        const deployment = (payload.deployment ?? payload) as Record<string, unknown>;
        const depStatus = payload.deployment_status as Record<string, unknown> | undefined;
        return {
          ...base,
          head_sha: deployment?.sha,
          environment: deployment?.environment,
          description: deployment?.description,
          deployment_status: depStatus?.state,
          deployment_url: depStatus?.target_url,
          raw: payload,
        };
      }

      default:
        return {
          ...base,
          head_sha:
            (payload.head_commit as Record<string, unknown>)?.id ?? payload.after ?? payload.sha,
          ref: payload.ref,
          raw: payload,
        };
    }
  }

  /**
   * Deep-parse a Sentry webhook payload.
   *
   * Sentry sends different shapes depending on the integration type:
   * - Issue alerts: `{ action, data: { issue, ... } }`
   * - Metric alerts: `{ action, data: { metric_alert, ... } }`
   * - Legacy webhooks: flat `{ message, level, project, ... }`
   *
   * We normalize all of them into a consistent envelope with the
   * exception details (type, value, stacktrace) extracted when present.
   */
  private parseSentryPayload(
    event: string | undefined,
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    const action = payload.action as string | undefined;
    const data = payload.data as Record<string, unknown> | undefined;
    const issue = data?.issue as Record<string, unknown> | undefined;
    const eventObj = (payload.event ?? data?.event) as Record<string, unknown> | undefined;

    // Extract exception details from the event's exception values
    const exceptionValues = (eventObj?.exception as Record<string, unknown>)?.values as
      | Array<Record<string, unknown>>
      | undefined;
    const topException = exceptionValues?.[0];
    const stacktrace = topException?.stacktrace as Record<string, unknown> | undefined;
    const frames = stacktrace?.frames as Array<Record<string, unknown>> | undefined;

    // Extract tags into a flat key→value map
    const tagsArray = (eventObj?.tags ?? issue?.tags) as Array<Record<string, unknown>> | undefined;
    const tags: Record<string, string> = {};
    if (Array.isArray(tagsArray)) {
      for (const tag of tagsArray) {
        if (tag.key && tag.value) tags[String(tag.key)] = String(tag.value);
      }
    }

    // Metric alert path (Sentry metric alerts have a different shape)
    const metricAlert = data?.metric_alert as Record<string, unknown> | undefined;
    if (metricAlert) {
      const metricTitle = (metricAlert.title ?? metricAlert.alert_rule_name) as string | undefined;
      return {
        source: 'sentry',
        event: event ?? 'metric_alert',
        action,
        alert_name: metricTitle,
        alert_status: (data?.description_title as string)?.toLowerCase(),
        metric_value: data?.value,
        threshold: metricAlert.value,
        project: payload.project_slug ?? payload.project,
        project_slug: payload.project_slug,
        organization: (payload.installation as Record<string, unknown>)?.uuid,
        issue_url: metricAlert.web_url,
        alert: buildAlertEnvelope({
          source: 'sentry',
          title: metricTitle ?? 'Sentry metric alert',
          url: metricAlert.web_url as string | undefined,
          severity: 'error',
          summary: data?.description_title as string | undefined,
          environment: undefined,
        }),
        raw: payload,
      };
    }

    const issueTitle = (issue?.title ?? eventObj?.title ?? payload.message) as string | undefined;
    const issueUrl = (issue?.web_url ?? issue?.permalink ?? payload.url) as string | undefined;
    const issueLevel = (issue?.level ?? payload.level ?? 'error') as string;
    const environment = (tags['environment'] ?? eventObj?.environment) as string | undefined;

    return {
      source: 'sentry',
      event: event ?? action ?? 'issue.alert',
      action,
      // Issue metadata
      issue_id: issue?.id,
      issue_title: issueTitle,
      issue_url: issueUrl,
      issue_status: issue?.status,
      issue_level: issueLevel,
      issue_first_seen: issue?.firstSeen ?? issue?.first_seen,
      issue_last_seen: issue?.lastSeen ?? issue?.last_seen,
      issue_count: issue?.count,
      // Exception details
      exception_type: topException?.type,
      exception_value: topException?.value,
      exception_module: topException?.module,
      stacktrace_frames: frames?.slice(-10).map(f => ({
        filename: f.filename ?? f.abs_path,
        function: f.function,
        lineno: f.lineno,
        colno: f.colno,
        context_line: f.context_line,
        in_app: f.in_app,
      })),
      // Context
      project:
        payload.project_slug ??
        payload.project ??
        (issue?.project as Record<string, unknown>)?.slug,
      project_slug: payload.project_slug ?? (issue?.project as Record<string, unknown>)?.slug,
      environment,
      release: tags['release'] ?? eventObj?.release,
      server_name: tags['server_name'] ?? eventObj?.server_name,
      transaction: eventObj?.transaction,
      tags,
      // User context
      user_id: (eventObj?.user as Record<string, unknown>)?.id,
      user_email: (eventObj?.user as Record<string, unknown>)?.email,
      user_ip: (eventObj?.user as Record<string, unknown>)?.ip_address,
      // Organization
      organization: (payload.installation as Record<string, unknown>)?.uuid,
      // Cross-provider normalized envelope. See buildAlertEnvelope.
      alert: buildAlertEnvelope({
        source: 'sentry',
        title: issueTitle ?? 'Sentry issue',
        url: issueUrl,
        severity: normalizeSentryLevel(issueLevel),
        summary:
          (topException?.value as string | undefined) ?? (eventObj?.message as string | undefined),
        environment,
      }),
      raw: payload,
    };
  }

  /**
   * Deep-parse a Datadog webhook payload.
   *
   * Datadog webhooks come in several flavors:
   * - Monitor alerts: `{ alert_title, alert_status, ... }`
   * - Event alerts: `{ event_title, event_type, ... }`
   * - The `$EVENT_MSG` template variable includes the full monitor body
   *
   * We normalize all of them, extracting monitor metadata, threshold
   * values, and affected resources.
   */
  private parseDatadogPayload(
    event: string | undefined,
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    // Parse tags from comma-separated string or array
    const rawTags = payload.tags as string | string[] | undefined;
    const tags: Record<string, string> = {};
    const tagsList: string[] =
      typeof rawTags === 'string'
        ? rawTags.split(',').map(t => t.trim())
        : Array.isArray(rawTags)
          ? rawTags
          : [];
    for (const tag of tagsList) {
      const [k, ...v] = tag.split(':');
      if (k) tags[k.trim()] = v.join(':').trim();
    }

    // Parse snapshot/graph URL
    const snapshotUrl = payload.snapshot ?? payload.event_snapshot_url;

    // Monitor-specific fields
    const monitorId = payload.id ?? payload.alert_id;
    const monitorName = payload.monitor_name ?? payload.alert_title ?? payload.title;
    const monitorType = payload.alert_type ?? payload.monitor_type;

    // Threshold parsing from alert_metric and alert_query
    const alertQuery = payload.alert_query as string | undefined;
    const alertMetric = payload.alert_metric as string | undefined;
    const alertTransition = payload.alert_transition as string | undefined;

    // Scopes (which hosts/services are affected)
    const scopes = payload.alert_scope ?? payload.scope ?? payload.hostname;

    const environment = (tags['env'] ?? tags['environment']) as string | undefined;
    const monitorUrl = (payload.link ?? payload.url) as string | undefined;
    const ddSeverity = (tags['severity'] ?? tags['alert_severity']) as string | undefined;
    const summary = (payload.body ?? payload.text ?? payload.event_msg) as string | undefined;

    return {
      source: 'datadog',
      event: event ?? alertTransition ?? 'alert',
      // Alert metadata
      alert_title: monitorName,
      alert_status: payload.alert_status,
      alert_type: monitorType,
      alert_transition: alertTransition,
      alert_cycle_key: payload.alert_cycle_key,
      // Monitor details
      monitor_id: monitorId,
      monitor_name: monitorName,
      monitor_query: alertQuery,
      monitor_metric: alertMetric,
      // Thresholds
      threshold: payload.alert_threshold,
      current_value: payload.value ?? payload.alert_current_value,
      // Priority and severity
      priority: payload.priority,
      severity: ddSeverity,
      // Scope (what's affected)
      scope: scopes,
      hostname: payload.hostname,
      service: tags['service'],
      environment,
      // Message
      message: summary,
      title: payload.alert_title ?? payload.title ?? payload.event_title,
      // Links
      snapshot_url: snapshotUrl,
      monitor_url: monitorUrl,
      // Timing
      last_updated: payload.last_updated ?? payload.date,
      last_updated_epoch: payload.last_updated_ts ?? payload.date_happened,
      // Tags (parsed into key→value)
      tags,
      tags_list: tagsList,
      // Organization
      org_id: (payload.org as Record<string, unknown>)?.id ?? payload.org_id,
      org_name: (payload.org as Record<string, unknown>)?.name ?? payload.org_name,
      // Cross-provider normalized envelope. See buildAlertEnvelope.
      alert: buildAlertEnvelope({
        source: 'datadog',
        title: (monitorName as string) ?? 'Datadog alert',
        url: monitorUrl,
        severity: normalizeDatadogSeverity(payload.priority as string | undefined, ddSeverity),
        summary,
        environment,
      }),
      raw: payload,
    };
  }
}

/**
 * Cross-provider alert envelope. Both Sentry and Datadog parsers
 * surface their own provider-specific shape (`issue_title`, `alert_title`,
 * etc.), but a runbook author who wants to support both sources used to
 * have to write conditional branches everywhere. This namespace gives
 * them a single template path that works regardless of where the alert
 * came from:
 *
 *   {{vars.alert.title}}      — short headline
 *   {{vars.alert.url}}        — link back to the originating UI
 *   {{vars.alert.severity}}   — info | warning | error | critical
 *   {{vars.alert.summary}}    — one-paragraph context (may be empty)
 *   {{vars.alert.environment}} — prod / staging / dev (may be empty)
 *   {{vars.alert.source}}     — 'sentry' | 'datadog' | future providers
 *
 * The provider-specific fields stay at the top level for runbooks that
 * intentionally bind to one source (e.g. an SRE workflow that always
 * starts from Sentry exception payloads). The envelope is additive,
 * never lossy.
 */
type AlertSeverity = 'info' | 'warning' | 'error' | 'critical' | 'unknown';

interface AlertEnvelope {
  source: string;
  title: string;
  url?: string;
  severity: AlertSeverity;
  summary?: string;
  environment?: string;
}

function buildAlertEnvelope(input: AlertEnvelope): AlertEnvelope {
  return {
    source: input.source,
    title: input.title,
    url: input.url,
    severity: input.severity,
    summary: input.summary,
    environment: input.environment,
  };
}

function normalizeSentryLevel(level: string | undefined): AlertSeverity {
  switch ((level ?? '').toLowerCase()) {
    case 'fatal':
      return 'critical';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    case 'debug':
      return 'info';
    default:
      return 'unknown';
  }
}

function normalizeDatadogSeverity(
  priority: string | undefined,
  tagSeverity: string | undefined
): AlertSeverity {
  // Priority ranks (P1 = highest, P5 = lowest) take precedence — they're
  // explicit in the monitor definition. Tag-based severity is the
  // free-form fallback some teams encode (e.g. severity:high).
  switch ((priority ?? '').toUpperCase()) {
    case 'P1':
      return 'critical';
    case 'P2':
      return 'error';
    case 'P3':
      return 'warning';
    case 'P4':
    case 'P5':
      return 'info';
  }
  switch ((tagSeverity ?? '').toLowerCase()) {
    case 'critical':
    case 'fatal':
      return 'critical';
    case 'high':
    case 'error':
      return 'error';
    case 'medium':
    case 'warning':
    case 'warn':
      return 'warning';
    case 'low':
    case 'info':
      return 'info';
    default:
      return 'unknown';
  }
}
