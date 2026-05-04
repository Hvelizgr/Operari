"""Slack-notify step — production-shaped Python plugin starter.

Three things this template demonstrates that the minimal
hello_world example doesn't:

  1. Real pydantic schema with multiple fields + per-field
     constraints. Typed config inside execute(), validated before
     the call by the loader's call to ``schema.parse``.
  2. Outbound HTTP via the ``requests`` library with an explicit
     timeout. Plugins should never hang the engine on a slow vendor.
  3. Structured success/failure return + ``ctx.emit('log', ...)``
     so the run detail page shows what happened.

Conventions:
  - The ``type`` MUST be namespaced (``<org>.<step-name>``).
    Unprefixed names collide with reserved core types and the loader
    will reject them at startup.
  - Read secrets via ``ctx.secrets[id]`` — the orchestrator
    pre-resolves ``{{secrets.<id>}}`` references in your config.
    Never hand-fetch from the secrets vault inside execute.
  - Return a PluginResult; throwing also works (the loader catches
    and shapes it as a FAILED result), but explicit returns make
    the failure mode clearer in the run detail page.
"""

from __future__ import annotations

import sys
from typing import Any

import requests
from pydantic import BaseModel, Field, ValidationError

from operari.steps import (
    PluginContext,
    PluginResult,
    PluginStepProperty,
    define_step,
    run_cli,
)


class SlackNotifyConfig(BaseModel):
    """Per-step config validated before execute() runs.

    pydantic gives us the typed object inside execute(); the loader
    calls ``model_validate`` via the schema callable below.
    """

    webhook_url: str = Field(..., min_length=1, description="Slack incoming webhook URL.")
    message: str = Field(..., min_length=1, max_length=4000)
    channel: str | None = Field(default=None, description="Optional channel override.")
    timeout_ms: int = Field(default=10_000, gt=0, le=60_000)


def _config_schema(raw: Any) -> dict[str, Any]:
    """Schema bridge — the loader expects a callable that returns a
    plain dict. We let pydantic validate, then dump to dict so the
    rest of the plugin sees a typed payload by convention.
    """
    try:
        parsed = SlackNotifyConfig.model_validate(raw if isinstance(raw, dict) else {})
    except ValidationError as exc:
        # Re-raise with a flat message so the engine's run log is
        # readable — pydantic's nested error structure is great in
        # Python but ugly in a single-line log row.
        details = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()
        )
        raise ValueError(f"slack-notify config invalid: {details}") from exc
    return parsed.model_dump()


def execute(config: dict[str, Any], ctx: PluginContext) -> PluginResult:
    cfg = SlackNotifyConfig.model_validate(config)
    timeout_s = cfg.timeout_ms / 1000.0

    ctx.emit(
        "log",
        f"Posting to Slack{f' ({cfg.channel})' if cfg.channel else ''}...",
    )

    try:
        body: dict[str, Any] = {"text": cfg.message}
        if cfg.channel:
            body["channel"] = cfg.channel
        res = requests.post(cfg.webhook_url, json=body, timeout=timeout_s)
    except requests.Timeout:
        return PluginResult(
            success=False,
            error=f"slack request timed out after {cfg.timeout_ms}ms",
        )
    except requests.RequestException as exc:
        return PluginResult(success=False, error=str(exc))

    if not res.ok:
        return PluginResult(
            success=False,
            error=f"slack returned {res.status_code}: {res.text[:200]}",
        )

    return PluginResult(
        success=True,
        output={"status": res.status_code, "channel": cfg.channel},
    )


step = define_step(
    type="example.py-slack-notify",
    config_schema=_config_schema,
    execute=execute,
    label={"en": "Slack notify (Python)", "es": "Slack notify (Python)"},
    description={
        "en": "Production-shaped Python plugin starter. Pydantic schema, requests with timeout.",
        "es": "Starter Python production-shaped. Pydantic, requests con timeout.",
    },
    icon="Bell",
    color="bg-emerald-500",
    category="notify",
    properties=[
        PluginStepProperty(
            name="webhook_url",
            display_name="Slack webhook URL",
            type="string",
            description="Supports {{secrets.<connected-account-id>}} references.",
            type_options={"expression": True},
        ),
        PluginStepProperty(
            name="message",
            display_name="Message",
            type="string",
            description="Supports {{vars.x}} and {{steps.x.output.y}} templates.",
            type_options={"expression": True},
        ),
        PluginStepProperty(
            name="channel",
            display_name="Channel (optional)",
            type="string",
        ),
        PluginStepProperty(
            name="timeout_ms",
            display_name="Timeout (ms)",
            type="number",
        ),
    ],
)


if __name__ == "__main__":
    sys.exit(run_cli(step))
