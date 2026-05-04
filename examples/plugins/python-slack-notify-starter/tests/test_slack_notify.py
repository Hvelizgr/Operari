"""Unit tests for the slack-notify Python plugin starter.

Mirrors the TypeScript starter's vitest suite — config validation,
happy path, 4xx surface, timeout surface. Uses ``responses`` to
stub the slack webhook so tests don't hit the network.
"""

from __future__ import annotations

import pytest
import requests
import responses

from plugin.slack_notify import _config_schema, execute


class FakeContext:
    """Minimal PluginContext stub. Real Operari hands a richer object
    (variables, previous_outputs, secrets, run_id, step_id, ...);
    only what slack-notify actually reads is implemented here.
    """

    def __init__(self) -> None:
        self.run_id = "run_test"
        self.step_id = "step_test"
        self.tenant_id = "tenant_test"
        self.variables: dict = {}
        self.previous_outputs: dict = {}
        self.secrets: dict = {}
        self.emitted: list[tuple[str, str]] = []

    def emit(self, event_type: str, text: str) -> None:
        self.emitted.append((event_type, text))


def test_config_rejects_empty_message() -> None:
    with pytest.raises(ValueError, match="message"):
        _config_schema({"webhook_url": "https://hooks.slack.com/abc", "message": ""})


def test_config_rejects_missing_webhook() -> None:
    with pytest.raises(ValueError, match="webhook_url"):
        _config_schema({"message": "hi"})


@responses.activate
def test_returns_success_on_200() -> None:
    responses.add(
        responses.POST,
        "https://hooks.slack.com/abc",
        body="ok",
        status=200,
    )
    cfg = _config_schema(
        {"webhook_url": "https://hooks.slack.com/abc", "message": "hello"}
    )
    res = execute(cfg, FakeContext())
    assert res.success is True
    assert res.output["status"] == 200


@responses.activate
def test_returns_failure_with_status_on_4xx() -> None:
    responses.add(
        responses.POST,
        "https://hooks.slack.com/abc",
        body="rate limited",
        status=429,
    )
    cfg = _config_schema(
        {"webhook_url": "https://hooks.slack.com/abc", "message": "hello"}
    )
    res = execute(cfg, FakeContext())
    assert res.success is False
    assert "429" in res.error


def test_surfaces_timeout_clearly(monkeypatch) -> None:
    """Timeout produces a clear 'timed out' error rather than a raw
    requests.Timeout traceback in the run log.
    """

    def _raise_timeout(*_args, **_kwargs):
        raise requests.Timeout("read timed out")

    monkeypatch.setattr(requests, "post", _raise_timeout)

    cfg = _config_schema(
        {"webhook_url": "https://hooks.slack.com/abc", "message": "hi", "timeout_ms": 50}
    )
    res = execute(cfg, FakeContext())
    assert res.success is False
    assert "timed out" in res.error


def test_emits_log_before_call() -> None:
    """The emit() side-effect happens before the request so a hung
    request still leaves a 'Posting to Slack...' line in the run
    timeline — operators can correlate with Slack's status page.
    """
    with responses.RequestsMock() as rsps:
        rsps.add(responses.POST, "https://hooks.slack.com/abc", status=200)
        cfg = _config_schema(
            {
                "webhook_url": "https://hooks.slack.com/abc",
                "message": "hi",
                "channel": "#ops",
            }
        )
        ctx = FakeContext()
        execute(cfg, ctx)
        assert len(ctx.emitted) == 1
        assert ctx.emitted[0][0] == "log"
        assert "#ops" in ctx.emitted[0][1]
