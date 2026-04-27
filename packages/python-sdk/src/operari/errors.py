"""Error classes mirroring the TypeScript SDK."""

from __future__ import annotations

from typing import Any, Optional


class OperariError(Exception):
    """Base error for all Operari API errors."""

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


class OperariAuthError(OperariError):
    """Raised on 401 Unauthorized."""

    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, status_code=401, code="unauthorized")


class OperariNotFoundError(OperariError):
    """Raised on 404 Not Found."""

    def __init__(self, resource: str = "Resource not found") -> None:
        super().__init__(resource, status_code=404, code="not_found")


class OperariTimeoutError(OperariError):
    """Raised when a polling operation exceeds its timeout."""

    def __init__(self, message: str = "Operation timed out") -> None:
        super().__init__(message, status_code=408, code="timeout")


