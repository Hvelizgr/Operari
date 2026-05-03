"""Type definitions mirroring the TypeScript SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class RunStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    PAUSED = "PAUSED"


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


@dataclass
class RunbookSummary:
    id: str
    slug: Optional[str]
    name: str
    description: Optional[str]
    category: Optional[str]
    created_at: str
    updated_at: str


@dataclass
class TriggerResponse:
    id: str
    runbook: dict[str, str]
    status: str
    triggered_at: str
    url: str


@dataclass
class StepLog:
    id: str
    step_id: str
    name: str
    type: str
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]
    duration: Optional[int]
    output: Any
    error: Optional[str]


@dataclass
class Run:
    id: str
    runbook: dict[str, str]
    status: RunStatus
    trigger: str
    started_at: str
    completed_at: Optional[str]
    duration: Optional[int]
    error: Optional[str]
    steps: list[StepLog] = field(default_factory=list)


@dataclass
class ResolvedApproval:
    id: str
    status: str
    workflow_id: str
    execution_id: str
    step_id: str
    approved_by: Optional[str]
    approved_at: Optional[str]
    comment: Optional[str]
    execution_resumed: bool
    execution_cancelled: bool


@dataclass
class AuditVerifyResult:
    tenant_id: str
    event_count: int
    intact: bool
    first_broken_seq: Optional[int]
    first_gap_after_seq: Optional[int]
    verified_at: str


@dataclass
class LogEntry:
    """A single log line emitted by the runtime for a specific run.

    Mirrors `LogEntry` in the TypeScript SDK. The `id` field is the
    monotonic stream cursor — pass it as `from_id` on the next
    `get_logs()` call to resume from where you left off.
    """

    id: str
    message: str
    timestamp: str
    metadata: Optional[dict[str, Any]] = None


@dataclass
class GetLogsResponse:
    """Bounded page of log entries for a finished or in-flight run."""

    execution_id: str
    entries: list[LogEntry]
    count: int
    """Approximate total entries in the run's stream — None when unknown."""
    total_approx: Optional[int]
    """Cursor for the next call. None when the page is the last one."""
    next_from_id: Optional[str]
