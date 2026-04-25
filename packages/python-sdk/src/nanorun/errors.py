"""Error classes mirroring the TypeScript SDK."""

from __future__ import annotations

from typing import Any, Optional


class NanoRunError(Exception):
    """Base error for all NanoRun API errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        code: Optional[str] = None,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.details = details


class NanoRunAuthError(NanoRunError):
    """Raised on 401 Unauthorized."""

    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, status_code=401, code="unauthorized")


class NanoRunNotFoundError(NanoRunError):
    """Raised on 404 Not Found."""

    def __init__(self, resource: str = "Resource not found") -> None:
        super().__init__(resource, status_code=404, code="not_found")


class NanoRunTimeoutError(NanoRunError):
    """Raised when a polling operation exceeds its timeout."""

    def __init__(self, message: str = "Operation timed out") -> None:
        super().__init__(message, status_code=408, code="timeout")


# Deprecated aliases — use NanoRun* instead. Kept for one release cycle
# so consumers pinned on the intermediate @cairn-era SDK don't break on
# upgrade.
CairnError = NanoRunError
CairnAuthError = NanoRunAuthError
CairnNotFoundError = NanoRunNotFoundError
CairnTimeoutError = NanoRunTimeoutError
