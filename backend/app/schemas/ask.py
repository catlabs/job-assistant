from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(min_length=1, description="User question about stored jobs.")
    job_id: str | None = Field(default=None, description="Optional job to focus the answer on.")
    include_profile: bool = Field(
        default=True,
        description="Include local user profile context when available.",
    )


class AskContext(BaseModel):
    total_jobs: int
    referenced_job_ids: list[str] = Field(default_factory=list)
    profile_loaded: bool = False


class AskResponse(BaseModel):
    question: str
    answer: str
    context: AskContext
    follow_up_suggestions: list[str] = Field(default_factory=list)
