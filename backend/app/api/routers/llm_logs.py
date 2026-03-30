from datetime import timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.core.security import require_api_key
from app.db.models import LlmCallLog
from app.db.session import get_db_session
from app.schemas.llm_log import LlmCallLogItem, LlmCallLogListResponse
from app.services.llm_pricing import estimate_token_cost_usd

router = APIRouter(prefix="/llm-logs", tags=["llm-logs"])


@router.get("/", response_model=LlmCallLogListResponse, dependencies=[Depends(require_api_key)])
def list_llm_logs(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    operation: str | None = Query(default=None),
    status: Literal["success", "error"] | None = Query(default=None),
) -> LlmCallLogListResponse:
    base_stmt = select(LlmCallLog)

    if operation:
        base_stmt = base_stmt.where(LlmCallLog.operation == operation)
    if status:
        base_stmt = base_stmt.where(LlmCallLog.status == status)

    stmt = base_stmt.order_by(LlmCallLog.created_at.desc()).offset(offset).limit(limit)
    count_stmt = select(func.count()).select_from(base_stmt.subquery())

    with get_db_session() as session:
        total_count = session.scalar(count_stmt) or 0
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
            token_cost_usd=estimate_token_cost_usd(
                model=record.model,
                prompt_tokens=record.prompt_tokens,
                completion_tokens=record.completion_tokens,
                total_tokens=record.total_tokens,
            ),
            status=record.status,
            job_id=record.job_id,
            error_message=record.error_message,
        )
        for record in records
    ]

    return LlmCallLogListResponse(count=len(logs), total_count=total_count, offset=offset, logs=logs)
