"""Define a custom Operari step in Python.

Mirrors the runtime contract of ``@operari/sdk/steps`` so the
Operari backend's plugin loader can treat Python plugins as a
first-class peer of TypeScript plugins. The actual bridge from
the Node.js loader to a Python subprocess lives in
:mod:`operari.steps.ipc`; this module is just the shape.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Generic, Literal, Optional, TypeVar

TConfig = TypeVar("TConfig")

EmitKind = Literal["stdout", "stderr", "log", "progress"]
"""Allowed kinds for :meth:`PluginContext.emit`. Matches the TS contract."""


@dataclass
class PluginEmitEvent:
    """One log line written by a step at runtime."""

    type: EmitKind
    text: str


@dataclass
class PluginContext:
    """Per-execution context handed to a step's ``execute`` function.

    Mirrors the TypeScript ``PluginContext`` interface: same field
    names, same semantics. The :meth:`emit` callable is wired by the
    IPC bridge so log output lands in the live run timeline; calling
    ``print`` from a step is invisible to operators.
    """

    run_id: str
    step_id: str
    tenant_id: str
    variables: dict[str, Any]
    previous_outputs: dict[str, Any]
    secrets: dict[str, str]
    emit: Callable[[EmitKind, str], None] = field(default=lambda _kind, _text: None)


@dataclass
class PluginResult:
    """Return shape from a step's ``execute`` function.

    ``success=True`` and the optional ``output`` mapping flow into
    ``previousOutputs[<this step id>]`` on the next step. ``error``
    is only meaningful when ``success`` is ``False``; throws are
    converted to ``PluginResult(success=False, error=<message>)`` by
    the IPC bridge.
    """

    success: bool
    output: Optional[dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class PluginStepProperty:
    """One field in a plugin's auto-generated config form.

    Mirrors the TypeScript ``PluginStepProperty`` interface. Drives
    Operari's editor to render real form inputs (text, select,
    boolean toggle, secret picker, sql editor) instead of falling
    back to a JSON textarea for plugin steps.
    """

    name: str
    display_name: str
    type: Literal["string", "boolean", "options", "number", "secret", "sql", "color"]
    default: Any = None
    description: Optional[str] = None
    options: Optional[list[dict[str, str]]] = None
    type_options: Optional[dict[str, Any]] = None


ExecuteFn = Callable[[Any, PluginContext], PluginResult | Awaitable[PluginResult]]


@dataclass
class PluginStep(Generic[TConfig]):
    """The descriptor a plugin module exports.

    Build via :func:`define_step`. The IPC bridge reads ``type``,
    ``config_schema``, and ``execute`` to wire the subprocess; the
    optional metadata fields plumb through to a NodeType row in the
    Operari DB so the editor's palette + properties panel render the
    plugin like a built-in step.
    """

    type: str
    config_schema: Callable[[Any], TConfig]
    execute: ExecuteFn
    label: Optional[str | dict[str, str]] = None
    description: Optional[str | dict[str, str]] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None
    inputs: Optional[list[dict[str, str]]] = None
    outputs: Optional[list[dict[str, str]]] = None
    properties: Optional[list[PluginStepProperty]] = None


_RESERVED_EXACT = {"shell", "approval", "notify", "wait", "ssh", "runbook"}
_RESERVED_PREFIXES = ("operari.",)


def _is_reserved(type_: str) -> bool:
    if type_ in _RESERVED_EXACT:
        return True
    return any(type_.startswith(p) for p in _RESERVED_PREFIXES)


def define_step(
    *,
    type: str,
    config_schema: Callable[[Any], Any],
    execute: ExecuteFn,
    label: Optional[str | dict[str, str]] = None,
    description: Optional[str | dict[str, str]] = None,
    icon: Optional[str] = None,
    color: Optional[str] = None,
    category: Optional[str] = None,
    inputs: Optional[list[dict[str, str]]] = None,
    outputs: Optional[list[dict[str, str]]] = None,
    properties: Optional[list[PluginStepProperty]] = None,
) -> PluginStep[Any]:
    """Author a custom step.

    Parameters mirror the TypeScript ``defineStep`` options. The
    ``config_schema`` callable is invoked with the raw config dict and
    must return the parsed config (or raise on invalid input). For
    pydantic users, pass ``MyModel.model_validate``; for plain
    validation, pass a function that does the checks and returns the
    dict; for the simplest case, ``lambda v: v``.

    Reserved step types (``shell``, ``approval``, ``notify``, ``wait``,
    ``ssh``, ``runbook``, ``operari.*``) are rejected here so a buggy
    plugin fails fast at import time instead of at backend boot.
    """
    if not isinstance(type, str) or not type:
        raise ValueError("define_step: type must be a non-empty string")
    if not callable(config_schema):
        raise ValueError("define_step: config_schema must be callable")
    if not callable(execute):
        raise ValueError("define_step: execute must be callable")
    if _is_reserved(type):
        raise ValueError(f"define_step: type '{type}' is reserved by Operari core")

    return PluginStep(
        type=type,
        config_schema=config_schema,
        execute=execute,
        label=label,
        description=description,
        icon=icon,
        color=color,
        category=category,
        inputs=inputs,
        outputs=outputs,
        properties=properties,
    )
