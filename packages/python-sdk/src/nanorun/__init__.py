"""NanoRun Python SDK — official client for the NanoRun API."""

from .client import NanoRun
from .errors import (
    NanoRunError,
    NanoRunAuthError,
    NanoRunNotFoundError,
    NanoRunTimeoutError,
    # deprecated aliases — use NanoRun* instead. Kept for one release
    # cycle so the intermediate Cairn-era consumers keep working.
    CairnError,
    CairnAuthError,
    CairnNotFoundError,
    CairnTimeoutError,
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

# Deprecated alias — use NanoRun instead.
Cairn = NanoRun

__all__ = [
    "NanoRun",
    "NanoRunError",
    "NanoRunAuthError",
    "NanoRunNotFoundError",
    "NanoRunTimeoutError",
    "Cairn",
    "CairnError",
    "CairnAuthError",
    "CairnNotFoundError",
    "CairnTimeoutError",
    "RunbookSummary",
    "TriggerResponse",
    "StepLog",
    "Run",
    "RunStatus",
    "ResolvedApproval",
    "AuditVerifyResult",
]

__version__ = "0.1.0"
