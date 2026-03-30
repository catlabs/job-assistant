from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

_bearer_scheme = HTTPBearer(auto_error=False)
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(
    bearer: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    api_key_header: str | None = Depends(_api_key_header),
) -> None:
    settings = get_settings()
    configured_api_key = settings.api_key.get_secret_value().strip() if settings.api_key else ""

    # Keep local development frictionless unless protected mode is explicitly enabled.
    if not configured_api_key:
        return

    presented_api_key = ""
    if bearer and bearer.scheme.lower() == "bearer":
        presented_api_key = bearer.credentials.strip()
    elif api_key_header:
        presented_api_key = api_key_header.strip()

    if not presented_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if presented_api_key != configured_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key.",
        )
