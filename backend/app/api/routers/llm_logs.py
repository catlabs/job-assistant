from datetime import timezone
from typing import Literal

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.db.models import LlmCallLog
from app.db.session import get_db_session
from app.schemas.llm_log import LlmCallLogItem, LlmCallLogListResponse

router = APIRouter(prefix="/llm-logs", tags=["llm-logs"])


@router.get("/", response_model=LlmCallLogListResponse)
def list_llm_logs(
    limit: int = Query(default=200, ge=1, le=1000),
    operation: str | None = Query(default=None),
    status: Literal["success", "error"] | None = Query(default=None),
) -> LlmCallLogListResponse:
    stmt = select(LlmCallLog).order_by(LlmCallLog.created_at.desc()).limit(limit)

    if operation:
        stmt = stmt.where(LlmCallLog.operation == operation)
    if status:
        stmt = stmt.where(LlmCallLog.status == status)

    with get_db_session() as session:
        records = session.scalars(stmt).all()

    logs = [
        LlmCallLogItem(
            id=record.id,
            created_at=(
                record.created_at
                if record.created_at.tzinfo is not None
                else record.created_at.replace(tzinfo=timezone.utc)
            ),
            operation=record.operation,
            model=record.model,
            prompt_tokens=record.prompt_tokens,
            completion_tokens=record.completion_tokens,
            total_tokens=record.total_tokens,
            status=record.status,
            job_id=record.job_id,
            error_message=record.error_message,
        )
        for record in records
    ]

    return LlmCallLogListResponse(count=len(logs), logs=logs)
