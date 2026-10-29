"""IPC bridge — turn a :class:`PluginStep` into a CLI subprocess.

The Operari Node.js plugin loader spawns a Python plugin as a child
process and pipes a single JSON message to its stdin: the step's
config + the run :class:`PluginContext`. The plugin reads it, calls
``execute``, writes a result JSON to stdout, and exits.

Message format (stdin):

.. code-block:: json

    {
      "config": { ... },
      "context": {
        "runId": "r1", "stepId": "s1", "tenantId": "t1",
        "variables": { ... }, "previousOutputs": { ... }, "secrets": { ... }
      }
    }

Streaming events (during execute):

.. code-block:: text

    EMIT {"type":"log","text":"..."}\\n
    EMIT {"type":"stdout","text":"..."}\\n

Final result (single line, after execute returns):

.. code-block:: text

    RESULT {"success": true, "output": { ... }}\\n
    RESULT {"success": false, "error": "..."}\\n

The ``EMIT`` / ``RESULT`` prefixes let the Node side multiplex events
and the final result over the same stdout pipe. The Operari runtime
parses each line and routes it appropriately. Any line that is not
prefixed (e.g. accidental ``print()``) is captured as raw stdout for
debugging but does not become a log event.
"""

from __future__ import annotations

import asyncio
import inspect
import json
import sys
import traceback
from typing import Any, IO

from .define_step import PluginContext, PluginResult, PluginStep


def _emit(stream: IO[str], kind: str, text: str) -> None:
    stream.write("EMIT " + json.dumps({"type": kind, "text": text}) + "\n")
    stream.flush()


def _write_result(stream: IO[str], result: PluginResult) -> None:
    payload: dict[str, Any] = {"success": bool(result.success)}
    if result.output is not None:
        payload["output"] = result.output
    if result.error is not None:
        payload["error"] = result.error
    stream.write("RESULT " + json.dumps(payload) + "\n")
    stream.flush()


def _build_context(
    raw: dict[str, Any], stdout: IO[str]
) -> PluginContext:
    """Materialize a :class:`PluginContext` from the JSON envelope.

    The Node side sends the same field names as the TS PluginContext
    (camelCase). We translate to snake_case for Pythonic ergonomics
    and preserve unknown fields untouched on a best-effort basis.
    """
    return PluginContext(
        run_id=str(raw.get("runId", "")),
        step_id=str(raw.get("stepId", "")),
        tenant_id=str(raw.get("tenantId", "")),
        variables=dict(raw.get("variables") or {}),
        previous_outputs=dict(raw.get("previousOutputs") or {}),
        secrets=dict(raw.get("secrets") or {}),
        emit=lambda kind, text: _emit(stdout, kind, text),
    )


async def _await(awaitable: Any) -> Any:
    return await awaitable


def execute_step(
    step: PluginStep[Any],
    payload: dict[str, Any],
    stdout: IO[str],
) -> PluginResult:
    """Run a step against an in-memory payload, emitting events to ``stdout``.

    Exposed for tests that want to bypass the stdin read but still
    exercise the same execute → result path the CLI takes.
    """
    raw_config = payload.get("config", {})
    raw_context = payload.get("context", {})

    try:
        config = step.config_schema(raw_config)
    except Exception as err:
        message = f"invalid config — {err}"
        return PluginResult(success=False, error=message)

    context = _build_context(raw_context, stdout)

    try:
        result = step.execute(config, context)
        # `async def execute` returns a coroutine; each plugin process runs
        # exactly one step, so it owns the event loop for its lifetime.
        if inspect.isawaitable(result):
            result = asyncio.run(_await(result))
    except Exception as err:
        # Mirror the TS adapter's behavior: an uncaught throw becomes
        # a structured failure result. We include the stack on stderr
        # for self-host operators tailing logs.
        traceback.print_exc(file=sys.stderr)
        return PluginResult(success=False, error=str(err))

    if not isinstance(result, PluginResult):
        return PluginResult(
            success=False,
            error=(
                "execute() must return a PluginResult; "
                f"got {type(result).__name__} instead"
            ),
        )
    return result


def run_cli(
    step: PluginStep[Any],
    *,
    stdin: IO[str] | None = None,
    stdout: IO[str] | None = None,
) -> int:
    """Read one JSON envelope from stdin, run the step, write a RESULT line.

    Returns the process exit code. ``0`` on a successful PluginResult
    write (including ``success=False`` results — the contract is
    "I produced a result", not "the step succeeded"). ``1`` only when
    even producing a result fails (malformed stdin, write error).

    A plugin module's ``__main__`` block typically calls::

        if __name__ == "__main__":
            from operari.steps import run_cli
            sys.exit(run_cli(my_step))
    """
    in_stream = stdin if stdin is not None else sys.stdin
    out_stream = stdout if stdout is not None else sys.stdout

    raw = in_stream.read()
    if not raw.strip():
        _write_result(out_stream, PluginResult(success=False, error="empty stdin"))
        return 1

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as err:
        _write_result(
            out_stream,
            PluginResult(success=False, error=f"stdin JSON parse failed: {err}"),
        )
        return 1

    if not isinstance(payload, dict):
        _write_result(
            out_stream,
            PluginResult(success=False, error="stdin payload must be a JSON object"),
        )
        return 1

    result = execute_step(step, payload, out_stream)
    _write_result(out_stream, result)
    return 0
