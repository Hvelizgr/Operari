"""Define-step shape + reserved-type guards. Mirrors the TS test
matrix in ``backend/src/__tests__/sdk-integration/define-step.test.ts``
so the two SDKs stay behaviorally identical.
"""

from __future__ import annotations

import io
import json

import pytest

from operari.steps import (
    PluginContext,
    PluginResult,
    PluginStepProperty,
    define_step,
)
from operari.steps.ipc import execute_step, run_cli


def _ok_schema(value):
    return value


def _ok_execute(_config, _context):
    return PluginResult(success=True)


def test_define_step_returns_descriptor_with_required_fields():
    step = define_step(
        type="example.ok",
        config_schema=_ok_schema,
        execute=_ok_execute,
    )
    assert step.type == "example.ok"
    assert step.config_schema is _ok_schema
    assert step.execute is _ok_execute


def test_define_step_rejects_empty_type():
    with pytest.raises(ValueError, match="non-empty string"):
        define_step(type="", config_schema=_ok_schema, execute=_ok_execute)


def test_define_step_rejects_non_callable_schema():
    with pytest.raises(ValueError, match="callable"):
        define_step(
            type="example.bad-schema",
            config_schema="not callable",  # type: ignore[arg-type]
            execute=_ok_execute,
        )


def test_define_step_rejects_non_callable_execute():
    with pytest.raises(ValueError, match="callable"):
        define_step(
            type="example.bad-execute",
            config_schema=_ok_schema,
            execute="not callable",  # type: ignore[arg-type]
        )


@pytest.mark.parametrize(
    "reserved",
    ["shell", "approval", "notify", "wait", "ssh", "runbook", "operari.httpRequest"],
)
def test_define_step_rejects_reserved_types(reserved: str):
    with pytest.raises(ValueError, match="reserved"):
        define_step(type=reserved, config_schema=_ok_schema, execute=_ok_execute)


def test_define_step_passes_optional_metadata_through():
    step = define_step(
        type="example.with-meta",
        config_schema=_ok_schema,
        execute=_ok_execute,
        label={"en": "Hello", "es": "Hola"},
        icon="MessageSquare",
        color="bg-emerald-500",
        category="custom",
        inputs=[{"name": "main", "type": "main"}],
        outputs=[{"name": "main", "type": "main"}],
        properties=[
            PluginStepProperty(
                name="msg", display_name="Message", type="string"
            ),
        ],
    )
    assert step.label == {"en": "Hello", "es": "Hola"}
    assert step.icon == "MessageSquare"
    assert step.category == "custom"
    assert step.properties is not None
    assert len(step.properties) == 1
    assert step.properties[0].name == "msg"


# ---------------------------------------------------------------------
# IPC bridge contract
# ---------------------------------------------------------------------


def test_execute_step_runs_and_emits_through_provided_stdout():
    captured: list[str] = []

    def execute(config, context: PluginContext):
        context.emit("log", f"hello {config['name']}")
        return PluginResult(success=True, output={"echoed": config["name"]})

    step = define_step(
        type="example.echo",
        config_schema=lambda v: v,
        execute=execute,
    )

    out = io.StringIO()
    payload = {
        "config": {"name": "alice"},
        "context": {
            "runId": "r1",
            "stepId": "s1",
            "tenantId": "t1",
            "variables": {},
            "previousOutputs": {},
            "secrets": {},
        },
    }
    result = execute_step(step, payload, out)

    assert result.success is True
    assert result.output == {"echoed": "alice"}

    emitted = [line for line in out.getvalue().splitlines() if line.startswith("EMIT ")]
    assert len(emitted) == 1
    payload = json.loads(emitted[0][len("EMIT ") :])
    assert payload == {"type": "log", "text": "hello alice"}


def test_execute_step_invalid_config_returns_failure_without_calling_execute():
    called: list[bool] = []

    def schema(value):
        raise ValueError("bad shape")

    def execute(_config, _context):
        called.append(True)
        return PluginResult(success=True)

    step = define_step(type="example.bad", config_schema=schema, execute=execute)

    out = io.StringIO()
    result = execute_step(
        step,
        {"config": {}, "context": {"runId": "r", "stepId": "s", "tenantId": "t"}},
        out,
    )

    assert result.success is False
    assert "invalid config" in (result.error or "")
    assert called == []


def test_execute_step_catches_thrown_execute():
    def execute(_config, _context):
        raise RuntimeError("kaboom")

    step = define_step(
        type="example.throw",
        config_schema=lambda v: v,
        execute=execute,
    )

    out = io.StringIO()
    result = execute_step(
        step,
        {"config": {}, "context": {"runId": "r", "stepId": "s", "tenantId": "t"}},
        out,
    )

    assert result.success is False
    assert "kaboom" in (result.error or "")


def test_run_cli_writes_result_line_on_happy_path():
    def execute(_config, _context):
        return PluginResult(success=True, output={"ok": True})

    step = define_step(
        type="example.cli",
        config_schema=lambda v: v,
        execute=execute,
    )

    payload = json.dumps(
        {
            "config": {},
            "context": {
                "runId": "r",
                "stepId": "s",
                "tenantId": "t",
                "variables": {},
                "previousOutputs": {},
                "secrets": {},
            },
        }
    )
    in_stream = io.StringIO(payload)
    out_stream = io.StringIO()

    code = run_cli(step, stdin=in_stream, stdout=out_stream)

    assert code == 0
    lines = out_stream.getvalue().splitlines()
    result_lines = [line for line in lines if line.startswith("RESULT ")]
    assert len(result_lines) == 1
    body = json.loads(result_lines[0][len("RESULT ") :])
    assert body == {"success": True, "output": {"ok": True}}


def test_run_cli_handles_empty_stdin_with_a_failure_result():
    step = define_step(
        type="example.empty",
        config_schema=lambda v: v,
        execute=_ok_execute,
    )

    out_stream = io.StringIO()
    code = run_cli(step, stdin=io.StringIO(""), stdout=out_stream)

    assert code == 1
    assert "RESULT " in out_stream.getvalue()
    body = json.loads(out_stream.getvalue().split("RESULT ", 1)[1])
    assert body["success"] is False
    assert "empty stdin" in body["error"]


def test_run_cli_rejects_non_json_stdin():
    step = define_step(
        type="example.bad-json",
        config_schema=lambda v: v,
        execute=_ok_execute,
    )

    out_stream = io.StringIO()
    code = run_cli(step, stdin=io.StringIO("not json"), stdout=out_stream)

    assert code == 1
    body = json.loads(out_stream.getvalue().split("RESULT ", 1)[1])
    assert body["success"] is False
    assert "JSON parse" in body["error"]
