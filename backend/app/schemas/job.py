from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class JobCreateRequest(BaseModel):
    title: str | None = Field(default=None, description="Optional raw title from the source.")
    company: str | None = Field(default=None, description="Optional company name from the source.")
    location: str | None = Field(default=None, description="Optional job location.")
    url: str | None = Field(default=None, description="Optional source URL.")
    source: str = Field(default="manual", description="Source identifier for the posting.")
    description: str = Field(min_length=1, description="Raw job posting text.")
    extraction_ref: str | None = Field(
        default=None,
        description="Opaque extraction reference returned by /jobs/extract-fields.",
    )


class JobDecisionV1(BaseModel):
    headline: str
    detail: str
    risk_flags: list[str] = Field(default_factory=list, max_length=4)
    clarifying_questions: list[str] = Field(default_factory=list, max_length=3)


class JobAnalysis(BaseModel):
    normalized_title: str | None = None
    normalized_company: str | None = None
    normalized_location: str | None = None
    seniority: str = "unknown"
    keywords: list[str] = Field(default_factory=list)
    summary: str
    fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"] | None = None
    fit_rationale: str = ""
    decision: JobDecisionV1 | None = None


class Job(BaseModel):
    id: str
    title: str | None = None
    company: str | None = None
    location: str | None = None
    url: str | None = None
    source: str
    description: str
    analysis: JobAnalysis
    created_at: datetime


class JobListResponse(BaseModel):
    count: int
    jobs: list[Job] = Field(default_factory=list)
