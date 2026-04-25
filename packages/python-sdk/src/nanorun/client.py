"""Official Python client for the NanoRun API.

Quick start::

    from cairn import NanoRun

    client = NanoRun(api_key="nrk_...")

    # Trigger a runbook and wait for completion
    run = client.run("deploy-frontend", variables={"env": "production"})
    print(run.status)  # RunStatus.SUCCESS

    # List recent runs
    runs = client.list_runs(status="FAILED", limit=5)

    # Grant an approval
    client.grant_approval("approval-id-here")
"""

from __future__ import annotations

import time
from typing import Any, Optional
from urllib.parse import quote, urlencode

import httpx

from .errors import (
    CairnError,
    CairnAuthError,
    CairnNotFoundError,
    CairnTimeoutError,
)
from .types import (
    AuditVerifyResult,
    ResolvedApproval,
    Run,
    RunStatus,
    RunbookSummary,
    StepLog,
    TriggerResponse,
)

DEFAULT_BASE_URL = "https://api.nanorun.dev"
TERMINAL_STATUSES = {RunStatus.SUCCESS, RunStatus.FAILED, RunStatus.CANCELLED}


class NanoRun:
    """NanoRun API client.

    Args:
        api_key: API key with the required scopes.
        base_url: Override the API base URL (default: https://api.nanorun.dev).
        timeout: HTTP request timeout in seconds (default: 30).
    """

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
    ) -> None:
        if not api_key:
            raise CairnError("api_key is required")
        self._base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "cairn-python/0.1.0",
            },
            timeout=timeout,
        )

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> NanoRun:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Runbooks
    # ------------------------------------------------------------------

    def list_runbooks(self) -> list[RunbookSummary]:
        """List all runbooks accessible to this API key."""
        data = self._request("GET", "/api/v1/runbooks")
        return [_parse_runbook(r) for r in data.get("data", [])]

    def trigger(
        self,
        runbook: str,
        *,
        variables: Optional[dict[str, Any]] = None,
    ) -> TriggerResponse:
        """Trigger a runbook by slug or id. Returns immediately."""
        data = self._request(
            "POST",
            f"/api/v1/runbooks/{quote(runbook, safe='')}/trigger",
            body={"variables": variables or {}},
        )
        return TriggerResponse(
            id=data["id"],
            runbook=data.get("runbook", {}),
            status=data["status"],
            triggered_at=data.get("triggeredAt", ""),
            url=data.get("url", ""),
        )

    # ------------------------------------------------------------------
    # Runs
    # ------------------------------------------------------------------

    def get_run(self, run_id: str) -> Run:
        """Get the current state of a run including step logs."""
        data = self._request("GET", f"/api/v1/runs/{quote(run_id, safe='')}")
        return _parse_run(data)

    def list_runs(
        self,
        *,
        status: Optional[str] = None,
        runbook: Optional[str] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> list[Run]:
        """List recent runs with optional filters."""
        params: dict[str, str] = {"limit": str(limit)}
        if status:
            params["status"] = status
        if runbook:
            params["runbook"] = runbook
        if cursor:
            params["cursor"] = cursor
        qs = urlencode(params)
        data = self._request("GET", f"/api/v1/runs?{qs}")
        return [_parse_run(r) for r in data.get("data", data.get("runs", []))]

    def wait_for_completion(
        self,
        run_id: str,
        *,
        timeout_ms: int = 300_000,
        poll_interval_ms: int = 1_000,
    ) -> Run:
        """Poll a run until it reaches a terminal state.

        Raises:
            CairnTimeoutError: If the run doesn't finish within timeout_ms.
        """
        start = time.monotonic()
        deadline = start + timeout_ms / 1000.0
        while time.monotonic() < deadline:
            run = self.get_run(run_id)
            if run.status in TERMINAL_STATUSES:
                return run
            time.sleep(poll_interval_ms / 1000.0)
        raise CairnTimeoutError(
            f"Run {run_id} did not complete within {timeout_ms}ms"
        )

    def run(
        self,
        runbook: str,
        *,
        variables: Optional[dict[str, Any]] = None,
        timeout_ms: int = 300_000,
    ) -> Run:
        """Trigger a runbook and wait for completion. Raises on failure."""
        triggered = self.trigger(runbook, variables=variables)
        result = self.wait_for_completion(triggered.id, timeout_ms=timeout_ms)
        if result.status == RunStatus.FAILED:
            raise CairnError(
                f"Run failed: {result.error or 'unknown error'}",
                status_code=500,
                code="run_failed",
            )
        return result

    # ------------------------------------------------------------------
    # Approvals
    # ------------------------------------------------------------------

    def grant_approval(
        self,
        approval_id: str,
        *,
        comment: Optional[str] = None,
    ) -> ResolvedApproval:
        """Grant a pending approval and resume execution."""
        data = self._request(
            "POST",
            f"/api/v1/approvals/{quote(approval_id, safe='')}/grant",
            body={"comment": comment} if comment else {},
        )
        return _parse_approval(data)

    def reject_approval(
        self,
        approval_id: str,
        *,
        comment: Optional[str] = None,
    ) -> ResolvedApproval:
        """Reject a pending approval and cancel execution."""
        data = self._request(
            "POST",
            f"/api/v1/approvals/{quote(approval_id, safe='')}/reject",
            body={"comment": comment} if comment else {},
        )
        return _parse_approval(data)

    # ------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------

    def verify_audit(
        self,
        *,
        from_seq: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> AuditVerifyResult:
        """Verify the tamper-evident audit chain integrity."""
        params: dict[str, str] = {}
        if from_seq is not None:
            params["fromSeq"] = str(from_seq)
        if page_size is not None:
            params["pageSize"] = str(page_size)
        qs = f"?{urlencode(params)}" if params else ""
        data = self._request("GET", f"/api/v1/audit/verify{qs}")
        return AuditVerifyResult(
            tenant_id=data.get("tenantId", ""),
            event_count=data.get("eventCount", 0),
            intact=data.get("intact", False),
            first_broken_seq=data.get("firstBrokenSeq"),
            first_gap_after_seq=data.get("firstGapAfterSeq"),
            verified_at=data.get("verifiedAt", ""),
        )

    # ------------------------------------------------------------------
    # HTTP layer
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        try:
            response = self._client.request(
                method,
                path,
                json=body if body else None,
            )
        except httpx.TimeoutException as exc:
            raise CairnTimeoutError(str(exc)) from exc

        if response.status_code == 204:
            return {}

        try:
            data = response.json()
        except Exception:
            data = {"error": response.text}

        if not response.is_success:
            msg = data.get("error", f"Request failed: {response.status_code}")
            code = data.get("code")
            if response.status_code == 401:
                raise CairnAuthError(msg)
            if response.status_code == 404:
                raise CairnNotFoundError(msg)
            raise CairnError(msg, response.status_code, code, data.get("details"))

        return data


# ------------------------------------------------------------------
# Parsers
# ------------------------------------------------------------------


def _parse_runbook(data: dict[str, Any]) -> RunbookSummary:
    return RunbookSummary(
        id=data.get("id", ""),
        slug=data.get("slug"),
        name=data.get("name", ""),
        description=data.get("description"),
        category=data.get("category"),
        created_at=data.get("createdAt", ""),
        updated_at=data.get("updatedAt", ""),
    )


def _parse_step(data: dict[str, Any]) -> StepLog:
    return StepLog(
        id=data.get("id", ""),
        step_id=data.get("stepId", data.get("nodeId", "")),
        name=data.get("name", data.get("nodeName", "")),
        type=data.get("type", data.get("nodeType", "")),
        status=data.get("status", ""),
        started_at=data.get("startedAt"),
        completed_at=data.get("completedAt"),
        duration=data.get("duration"),
        output=data.get("output"),
        error=data.get("error"),
    )


def _parse_run(data: dict[str, Any]) -> Run:
    rb = data.get("runbook") or data.get("workflow") or {}
    steps_raw = data.get("steps") or data.get("nodeLogs") or []
    return Run(
        id=data.get("id", ""),
        runbook=rb if isinstance(rb, dict) else {"name": str(rb)},
        status=RunStatus(data.get("status", "PENDING")),
        trigger=data.get("trigger", ""),
        started_at=data.get("startedAt", ""),
        completed_at=data.get("completedAt"),
        duration=data.get("duration"),
        error=data.get("error"),
        steps=[_parse_step(s) for s in steps_raw],
    )


def _parse_approval(data: dict[str, Any]) -> ResolvedApproval:
    return ResolvedApproval(
        id=data.get("id", ""),
        status=data.get("status", ""),
        workflow_id=data.get("workflowId", ""),
        execution_id=data.get("executionId", ""),
        step_id=data.get("stepId", ""),
        approved_by=data.get("approvedBy"),
        approved_at=data.get("approvedAt"),
        comment=data.get("comment"),
        execution_resumed=data.get("executionResumed", False),
        execution_cancelled=data.get("executionCancelled", False),
    )
