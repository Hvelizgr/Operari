"""Async-flavoured client for the Operari API.

Mirrors :class:`operari.Operari` method-for-method but uses
``httpx.AsyncClient`` so every entry point is awaitable. The async
variant exists so consumers running in asyncio frameworks (FastAPI,
aiohttp, Trio with a sniffio bridge, …) can call the SDK without
blocking the event loop on a synchronous HTTP roundtrip.

Quick start::

    import asyncio
    from operari import OperariAsync

    async def main() -> None:
        async with OperariAsync(api_key="nrk_...") as client:
            run = await client.run("deploy-frontend", variables={"env": "production"})
            print(run.status)

            # Live log tail
            async for entry in client.tail_logs(run.id):
                print(entry.message)

    asyncio.run(main())

All method signatures match the sync class — the only difference is
``await`` semantics. Keep both classes in sync when adding new API
surface; the parser helpers in :mod:`operari.client` are reused so
changes to response shape only have to land in one place.
"""

from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator, Optional
from urllib.parse import quote, urlencode

import httpx

from .client import (
    TERMINAL_STATUSES,
    _parse_approval,
    _parse_log_entry,
    _parse_logs_response,
    _parse_run,
    _parse_runbook,
    _parse_sse_event,
)
from .errors import (
    OperariAuthError,
    OperariError,
    OperariNotFoundError,
    OperariTimeoutError,
)
from .types import (
    AuditVerifyResult,
    GetLogsResponse,
    LogEntry,
    ResolvedApproval,
    Run,
    RunStatus,
    RunbookSummary,
    TriggerResponse,
)

DEFAULT_BASE_URL = "https://api.operari.dev"


class OperariAsync:
    """Asyncio-friendly Operari API client."""

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
    ) -> None:
        if not api_key:
            raise OperariError("api_key is required")
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "operari-python/0.1.0",
            },
            timeout=timeout,
        )

    async def aclose(self) -> None:
        """Close the underlying HTTP client. Safe to call multiple times."""
        await self._client.aclose()

    async def __aenter__(self) -> OperariAsync:
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()

    # ------------------------------------------------------------------
    # Runbooks
    # ------------------------------------------------------------------

    async def list_runbooks(self) -> list[RunbookSummary]:
        data = await self._request("GET", "/api/v1/runbooks")
        return [_parse_runbook(r) for r in data.get("data", [])]

    async def trigger(
        self,
        runbook: str,
        *,
        variables: Optional[dict[str, Any]] = None,
    ) -> TriggerResponse:
        data = await self._request(
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

    async def get_run(self, run_id: str) -> Run:
        data = await self._request("GET", f"/api/v1/runs/{quote(run_id, safe='')}")
        return _parse_run(data)

    async def list_runs(
        self,
        *,
        status: Optional[str] = None,
        runbook: Optional[str] = None,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> list[Run]:
        params: dict[str, str] = {"limit": str(limit)}
        if status:
            params["status"] = status
        if runbook:
            params["runbook"] = runbook
        if cursor:
            params["cursor"] = cursor
        qs = urlencode(params)
        data = await self._request("GET", f"/api/v1/runs?{qs}")
        return [_parse_run(r) for r in data.get("data", data.get("runs", []))]

    async def wait_for_completion(
        self,
        run_id: str,
        *,
        timeout_ms: int = 300_000,
        poll_interval_ms: int = 1_000,
    ) -> Run:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout_ms / 1000.0
        while loop.time() < deadline:
            run = await self.get_run(run_id)
            if run.status in TERMINAL_STATUSES:
                return run
            await asyncio.sleep(poll_interval_ms / 1000.0)
        raise OperariTimeoutError(
            f"Run {run_id} did not complete within {timeout_ms}ms"
        )

    async def run(
        self,
        runbook: str,
        *,
        variables: Optional[dict[str, Any]] = None,
        timeout_ms: int = 300_000,
    ) -> Run:
        triggered = await self.trigger(runbook, variables=variables)
        result = await self.wait_for_completion(triggered.id, timeout_ms=timeout_ms)
        if result.status == RunStatus.FAILED:
            raise OperariError(
                f"Run failed: {result.error or 'unknown error'}",
                status_code=500,
                code="run_failed",
            )
        return result

    # ------------------------------------------------------------------
    # Approvals
    # ------------------------------------------------------------------

    async def grant_approval(
        self,
        approval_id: str,
        *,
        comment: Optional[str] = None,
    ) -> ResolvedApproval:
        data = await self._request(
            "POST",
            f"/api/v1/approvals/{quote(approval_id, safe='')}/grant",
            body={"comment": comment} if comment else {},
        )
        return _parse_approval(data)

    async def reject_approval(
        self,
        approval_id: str,
        *,
        comment: Optional[str] = None,
    ) -> ResolvedApproval:
        data = await self._request(
            "POST",
            f"/api/v1/approvals/{quote(approval_id, safe='')}/reject",
            body={"comment": comment} if comment else {},
        )
        return _parse_approval(data)

    # ------------------------------------------------------------------
    # Logs
    # ------------------------------------------------------------------

    async def get_logs(
        self,
        run_id: str,
        *,
        from_id: Optional[str] = None,
        count: Optional[int] = None,
    ) -> GetLogsResponse:
        params: dict[str, str] = {}
        if from_id is not None:
            params["fromId"] = from_id
        if count is not None:
            params["count"] = str(count)
        qs = f"?{urlencode(params)}" if params else ""
        data = await self._request(
            "GET", f"/api/executions/{quote(run_id, safe='')}/logs{qs}"
        )
        return _parse_logs_response(data)

    async def tail_logs(
        self,
        run_id: str,
        *,
        from_id: Optional[str] = None,
    ) -> AsyncIterator[LogEntry]:
        """Yield log entries as the runtime emits them.

        Stop the iteration by ``break``-ing inside the ``async for``,
        or by closing the generator (``await gen.aclose()``). The
        underlying SSE connection is torn down promptly when the
        consumer hangs up.
        """
        params: dict[str, str] = {"follow": "true"}
        if from_id is not None:
            params["fromId"] = from_id
        path = f"/api/executions/{quote(run_id, safe='')}/logs?{urlencode(params)}"

        try:
            async with self._client.stream(
                "GET",
                path,
                headers={"Accept": "text/event-stream"},
                timeout=None,
            ) as response:
                if response.status_code == 401:
                    body = await response.aread()
                    raise OperariAuthError(
                        f"tail_logs unauthorized: {body.decode(errors='replace')}"
                    )
                if response.status_code == 404:
                    body = await response.aread()
                    raise OperariNotFoundError(
                        f"tail_logs not found: {body.decode(errors='replace')}"
                    )
                if response.status_code >= 400:
                    raise OperariError(
                        f"tail_logs failed: {response.status_code}",
                        status_code=response.status_code,
                    )

                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n\n" in buffer:
                        raw, _, buffer = buffer.partition("\n\n")
                        entry = _parse_sse_event(raw)
                        if entry is not None:
                            yield entry
        except httpx.TimeoutException:
            return

    # ------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------

    async def verify_audit(
        self,
        *,
        from_seq: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> AuditVerifyResult:
        params: dict[str, str] = {}
        if from_seq is not None:
            params["fromSeq"] = str(from_seq)
        if page_size is not None:
            params["pageSize"] = str(page_size)
        qs = f"?{urlencode(params)}" if params else ""
        data = await self._request("GET", f"/api/v1/audit/verify{qs}")
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

    async def _request(
        self,
        method: str,
        path: str,
        *,
        body: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        try:
            response = await self._client.request(
                method,
                path,
                json=body if body else None,
            )
        except httpx.TimeoutException as exc:
            raise OperariTimeoutError(str(exc)) from exc

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
                raise OperariAuthError(msg)
            if response.status_code == 404:
                raise OperariNotFoundError(msg)
            raise OperariError(
                msg, response.status_code, code, data.get("details")
            )

        return data
