from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.extract_fields import JobCriteria


class JobCreateRequest(BaseModel):
    title: str | None = Field(default=None, description="Optional raw title from the source.")
    company: str | None = Field(default=None, description="Optional company name from the source.")
    location: str | None = Field(default=None, description="Optional job location.")
    url: str | None = Field(default=None, description="Optional source URL.")
    source: str = Field(default="manual", description="Source identifier for the posting.")
    description: str = Field(min_length=1, description="Raw job posting text.")
    criteria: JobCriteria | None = Field(
        default=None,
        description="Optional extracted job criteria to persist directly with the job.",
    )


class Job(BaseModel):
    id: str
    title: str | None = None
    company: str | None = None
    location: str | None = None
    url: str | None = None
    source: str
    description: str
    criteria: JobCriteria
    created_at: datetime


class JobListResponse(BaseModel):
    count: int
    jobs: list[Job] = Field(default_factory=list)
