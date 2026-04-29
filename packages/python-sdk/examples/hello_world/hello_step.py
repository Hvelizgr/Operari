"""Minimal example: a Python plugin that says hello.

To use:

1. Install the SDK in your plugin venv: ``pip install operari``
2. Drop this file into your plugin directory alongside a small
   manifest. Minimal manifest (``operari.json``)::

       {
         "type": "myorg.hello-world",
         "language": "python",
         "entry": "hello_step.py"
       }

3. Tell Operari about the directory: ``OPERARI_PLUGINS_DIR=/path/to/plugins``
4. Boot the backend. The runtime spawns ``python hello_step.py`` per
   step invocation, pipes the run context in, and reads the result back.

In-process testing without a backend::

    cat <<EOF | python hello_step.py
    {
      "config": {"name": "Operari"},
      "context": {
        "runId": "r1", "stepId": "s1", "tenantId": "t1",
        "variables": {}, "previousOutputs": {}, "secrets": {}
      }
    }
    EOF

You should see one ``EMIT`` line and one ``RESULT`` line on stdout.
"""

from __future__ import annotations

import sys
from typing import Any

from operari.steps import (
    PluginContext,
    PluginResult,
    PluginStepProperty,
    define_step,
    run_cli,
)


def parse_config(raw: Any) -> dict[str, Any]:
    """Minimal validator. For real plugins, swap in a pydantic model.

    Pydantic example::

        from pydantic import BaseModel

        class HelloConfig(BaseModel):
            name: str

        config_schema = HelloConfig.model_validate
    """
    if not isinstance(raw, dict):
        raise ValueError("config must be an object")
    name = raw.get("name", "world")
    if not isinstance(name, str) or not name:
        raise ValueError("config.name must be a non-empty string")
    return {"name": name}


def execute(config: dict[str, Any], context: PluginContext) -> PluginResult:
    name = config["name"]
    context.emit("log", f"Hello plugin saying hi to {name} (run {context.run_id})")
    return PluginResult(success=True, output={"greeted": name})


step = define_step(
    type="myorg.hello-world",
    config_schema=parse_config,
    execute=execute,
    label={"en": "Hello world", "es": "Hola mundo"},
    description={
        "en": "Smallest possible Python plugin — emits one log + a greeted output.",
        "es": "Plugin Python más simple — emite un log + un output greeted.",
    },
    icon="MessageSquare",
    color="bg-emerald-500",
    category="custom",
    properties=[
        PluginStepProperty(
            name="name",
            display_name="Name to greet",
            type="string",
            description="Supports {{vars.x}} templates from the runbook.",
            type_options={"expression": True},
        ),
    ],
)


if __name__ == "__main__":
    sys.exit(run_cli(step))
