"""Step authoring surface for Operari plugins written in Python.

Mirrors the TypeScript ``@operari/sdk/steps`` package. A plugin
author writes a single :func:`define_step` call in a Python module
and wires it up through the IPC bridge so the Operari backend can
spawn the module as a subprocess and pass step config + run context
on stdin, reading the :class:`PluginResult` back from stdout.

Quick start::

    from operari.steps import define_step, PluginContext, PluginResult

    def execute(config: dict, context: PluginContext) -> PluginResult:
        context.emit("log", f"slack url={config['webhook']}")
        return PluginResult(success=True, output={"delivered": True})

    step = define_step(
        type="myorg.slack-notify",
        config_schema=lambda v: v,  # Or a pydantic model's `.parse_obj`.
        execute=execute,
    )

    if __name__ == "__main__":
        from operari.steps import run_cli
        run_cli(step)
"""

from .define_step import (
    PluginContext,
    PluginEmitEvent,
    PluginResult,
    PluginStep,
    PluginStepProperty,
    define_step,
)
from .ipc import run_cli

__all__ = [
    "PluginContext",
    "PluginEmitEvent",
    "PluginResult",
    "PluginStep",
    "PluginStepProperty",
    "define_step",
    "run_cli",
]
