from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.db.models import LlmCallLog
from app.db.session import SessionLocal
_MAX_ERROR_MESSAGE_LENGTH = 500


def _sanitize_error_message(error_message: str | None) -> str | None:
    if error_message is None:
        return None

    compact_message = " ".join(error_message.split())
    if not compact_message:
        return None

    return compact_message[:_MAX_ERROR_MESSAGE_LENGTH]


def _extract_usage_tokens(usage: Any) -> tuple[int | None, int | None, int | None]:
    if usage is None:
        return None, None, None

    return (
        getattr(usage, "prompt_tokens", None),
        getattr(usage, "completion_tokens", None),
        getattr(usage, "total_tokens", None),
    )


def log_llm_call(
    *,
    operation: str,
    status: str,
    model: str | None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
    job_id: str | None = None,
    error_message: str | None = None,
    extra_json: str | None = None,
) -> None:
    """Best-effort metadata logging for actual LLM API calls only.

    This helper intentionally uses an independent short-lived DB session and
    swallows all failures so business flows are never blocked by logging.
    """

    try:
        session = SessionLocal()
        try:
            session.add(
                LlmCallLog(
                    id=str(uuid4()),
                    created_at=datetime.now(timezone.utc),
                    operation=str(operation),
                    status=status,
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    job_id=job_id,
                    error_message=_sanitize_error_message(error_message),
                    extra_json=extra_json,
                )
            )
            session.commit()
        finally:
            session.close()
    except Exception:
        # Never break extraction/save/fit flows because of observability logging.
        return
