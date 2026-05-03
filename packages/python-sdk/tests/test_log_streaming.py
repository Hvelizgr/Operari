"""get_logs / tail_logs parity between sync and async clients.

The new log methods land on both Operari (sync) and OperariAsync.
These tests use httpx.MockTransport so the SDK's HTTP path is
exercised end-to-end without a backend running.
"""

from __future__ import annotations

import asyncio
from typing import Optional

import httpx
import pytest

from operari import LogEntry, Operari, OperariAsync
from operari.client import _parse_sse_event


# --------------------------------------------------------------------
# Pure helper — SSE parser
# --------------------------------------------------------------------


def test_sse_parser_picks_data_line_and_skips_comments():
    raw = ":heartbeat\nid: 42\nevent: log\ndata: " + '{"id":"42","message":"hello","timestamp":"t"}'
    entry = _parse_sse_event(raw)
    assert entry is not None
    assert entry.id == "42"
    assert entry.message == "hello"


def test_sse_parser_returns_none_for_heartbeat_blocks():
    assert _parse_sse_event(":just a heartbeat") is None


def test_sse_parser_concatenates_multi_line_data():
    raw = "data: {\ndata:   \"id\":\"1\",\"message\":\"x\",\"timestamp\":\"t\"\ndata: }"
    entry = _parse_sse_event(raw)
    assert entry is not None
    assert entry.id == "1"


def test_sse_parser_returns_none_for_invalid_json():
    assert _parse_sse_event("data: not-json-at-all") is None


# --------------------------------------------------------------------
# Sync get_logs
# --------------------------------------------------------------------


def _build_sync_client(handler) -> Operari:
    client = Operari(api_key="nrk_test", base_url="https://api.test")
    transport = httpx.MockTransport(handler)
    client._client = httpx.Client(  # type: ignore[attr-defined]
        base_url="https://api.test",
        headers={"Authorization": "Bearer nrk_test"},
        transport=transport,
        timeout=5.0,
    )
    return client


def test_sync_get_logs_decodes_pagination_envelope():
    captured: dict[str, Optional[str]] = {"path": None}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = str(request.url.path) + ("?" + str(request.url.query.decode()) if request.url.query else "")
        return httpx.Response(
            200,
            json={
                "executionId": "run-1",
                "entries": [
                    {"id": "1", "message": "hello", "timestamp": "t1"},
                    {"id": "2", "message": "world", "timestamp": "t2"},
                ],
                "count": 2,
                "totalApprox": 2,
                "nextFromId": None,
            },
        )

    client = _build_sync_client(handler)
    page = client.get_logs("run-1", from_id="0", count=10)
    client.close()
    assert page.execution_id == "run-1"
    assert [e.id for e in page.entries] == ["1", "2"]
    assert page.count == 2
    assert page.next_from_id is None
    assert captured["path"] == "/api/executions/run-1/logs?fromId=0&count=10"


def test_sync_tail_logs_streams_sse_events():
    sse_body = (
        ":heartbeat\n\n"
        + 'data: {"id":"1","message":"first","timestamp":"t1"}\n\n'
        + 'data: {"id":"2","message":"second","timestamp":"t2"}\n\n'
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert "follow=true" in request.url.query.decode()
        return httpx.Response(
            200,
            text=sse_body,
            headers={"Content-Type": "text/event-stream"},
        )

    client = _build_sync_client(handler)
    entries = list(client.tail_logs("run-1"))
    client.close()
    assert [e.id for e in entries] == ["1", "2"]
    assert entries[0].message == "first"


# --------------------------------------------------------------------
# Async client
# --------------------------------------------------------------------


def _build_async_client(handler) -> OperariAsync:
    client = OperariAsync(api_key="nrk_test", base_url="https://api.test")
    transport = httpx.MockTransport(handler)
    # Replace the real AsyncClient with one bound to the mock transport.
    client._client = httpx.AsyncClient(  # type: ignore[attr-defined]
        base_url="https://api.test",
        headers={"Authorization": "Bearer nrk_test"},
        transport=transport,
        timeout=5.0,
    )
    return client


def test_async_get_logs_round_trips_through_mock_transport():
    async def runner() -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "executionId": "run-2",
                    "entries": [{"id": "9", "message": "ok", "timestamp": "t"}],
                    "count": 1,
                    "totalApprox": 1,
                    "nextFromId": None,
                },
            )

        client = _build_async_client(handler)
        try:
            page = await client.get_logs("run-2")
            assert page.execution_id == "run-2"
            assert len(page.entries) == 1
            assert page.entries[0].message == "ok"
        finally:
            await client.aclose()

    asyncio.run(runner())


def test_async_tail_logs_yields_sse_entries():
    async def runner() -> None:
        sse_body = (
            'data: {"id":"a","message":"first","timestamp":"t"}\n\n'
            + 'data: {"id":"b","message":"second","timestamp":"t"}\n\n'
        )

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                text=sse_body,
                headers={"Content-Type": "text/event-stream"},
            )

        client = _build_async_client(handler)
        seen: list[LogEntry] = []
        try:
            async for entry in client.tail_logs("run-3"):
                seen.append(entry)
                if len(seen) == 2:
                    break
        finally:
            await client.aclose()
        assert [e.id for e in seen] == ["a", "b"]

    asyncio.run(runner())


def test_async_run_returns_when_status_is_terminal():
    """Smoke test: trigger → poll → terminal status → returned Run."""

    async def runner() -> None:
        calls = {"trigger": 0, "get": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            path = str(request.url.path)
            if path.endswith("/trigger"):
                calls["trigger"] += 1
                return httpx.Response(
                    200,
                    json={
                        "id": "run-9",
                        "runbook": {"id": "rb-1", "name": "x"},
                        "status": "RUNNING",
                        "triggeredAt": "t",
                        "url": "u",
                    },
                )
            if path.startswith("/api/v1/runs/"):
                calls["get"] += 1
                # First poll: still RUNNING. Second poll: SUCCESS.
                status = "RUNNING" if calls["get"] == 1 else "SUCCESS"
                return httpx.Response(
                    200,
                    json={
                        "id": "run-9",
                        "runbook": {"name": "x"},
                        "status": status,
                        "trigger": "MANUAL",
                        "startedAt": "t",
                        "completedAt": "t" if status == "SUCCESS" else None,
                        "duration": 100,
                        "error": None,
                        "steps": [],
                    },
                )
            return httpx.Response(404, json={"error": "unknown path"})

        client = _build_async_client(handler)
        try:
            result = await client.run("rb-1", timeout_ms=2_000)
            assert result.id == "run-9"
            # Two polls: first still running, second terminal.
            assert calls["get"] == 2
        finally:
            await client.aclose()

    asyncio.run(runner())


def test_operari_async_in_context_manager_closes_cleanly():
    async def runner() -> None:
        client = OperariAsync(api_key="nrk_test", base_url="https://api.test")
        async with client as same:
            assert same is client
        # After exit, calls must fail because the client is closed.
        with pytest.raises(RuntimeError):
            await client.list_runbooks()

    asyncio.run(runner())
