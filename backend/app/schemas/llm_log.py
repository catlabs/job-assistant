from datetime import datetime

from pydantic import BaseModel, Field


class LlmCallLogItem(BaseModel):
    id: str
    created_at: datetime
    operation: str
    model: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    status: str
    job_id: str | None = None
    error_message: str | None = None


class LlmCallLogListResponse(BaseModel):
    count: int
    logs: list[LlmCallLogItem] = Field(default_factory=list)
