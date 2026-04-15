"""Cairn Python SDK — official client for the Cairn API."""

from .client import Cairn
from .errors import (
    CairnError,
    CairnAuthError,
    CairnNotFoundError,
    CairnTimeoutError,
    # deprecated aliases — use Cairn* instead
    NanoRunError,
    NanoRunAuthError,
    NanoRunNotFoundError,
    NanoRunTimeoutError,
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

# Deprecated alias — use Cairn instead.
NanoRun = Cairn

__all__ = [
    "Cairn",
    "CairnError",
    "CairnAuthError",
    "CairnNotFoundError",
    "CairnTimeoutError",
    "NanoRun",
    "NanoRunError",
    "NanoRunAuthError",
    "NanoRunNotFoundError",
    "NanoRunTimeoutError",
    "RunbookSummary",
    "TriggerResponse",
    "StepLog",
    "Run",
    "RunStatus",
    "ResolvedApproval",
    "AuditVerifyResult",
]

__version__ = "0.1.0"
