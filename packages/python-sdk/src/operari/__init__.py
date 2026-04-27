"""Operari Python SDK — official client for the Operari API."""

from .client import Operari
from .errors import (
    OperariError,
    OperariAuthError,
    OperariNotFoundError,
    OperariTimeoutError,
)
from .types import (
    RunbookSummary,
    TriggerResponse,
    StepLog,
    Run,
    RunStatus,
    ResolvedApproval,
    AuditVerifyResult,
)

__all__ = [
    "Operari",
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
]

__version__ = "0.1.0"
