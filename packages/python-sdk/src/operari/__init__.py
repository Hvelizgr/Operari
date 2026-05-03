"""Operari Python SDK — official client for the Operari API."""

from .client import Operari
from .client_async import OperariAsync
from .errors import (
    OperariError,
    OperariAuthError,
    OperariNotFoundError,
    OperariTimeoutError,
)
from .types import (
    AuditVerifyResult,
    GetLogsResponse,
    LogEntry,
    ResolvedApproval,
    Run,
    RunbookSummary,
    RunStatus,
    StepLog,
    TriggerResponse,
)

__all__ = [
    "Operari",
    "OperariAsync",
    "OperariError",
    "OperariAuthError",
    "OperariNotFoundError",
    "OperariTimeoutError",
    "RunbookSummary",
    "TriggerResponse",
    "StepLog",
    "Run",
    "RunStatus",
    "ResolvedApproval",
    "AuditVerifyResult",
    "LogEntry",
    "GetLogsResponse",
]

# Step authoring lives at `operari.steps` so plugin modules import:
#   from operari.steps import define_step, run_cli, PluginContext, PluginResult
# Re-exporting at the top level would mix the API client with the
# plugin runtime and add hard-to-follow circular imports for
# downstream tooling.

__version__ = "0.1.0"
