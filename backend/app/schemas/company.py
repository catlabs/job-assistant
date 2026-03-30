from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


CompanyIngestStatus = Literal["complete", "partial", "failed"]
MAX_ADDITIONAL_SOURCE_URLS = 5


class CompanyPage(BaseModel):
    url: str
    path: str
    status_code: int | None = None
    title: str | None = None
    text_excerpt: str | None = None
    text_length: int = 0


class CompanyEnrichment(BaseModel):
    summary: str = ""
    product_or_domain_signals: list[str] = Field(default_factory=list, max_length=6)
    hiring_or_team_signals: list[str] = Field(default_factory=list, max_length=6)
    maturity_or_stage_signals: list[str] = Field(default_factory=list, max_length=6)
    risk_flags_or_unknowns: list[str] = Field(default_factory=list, max_length=6)
    source_urls_used: list[str] = Field(default_factory=list, max_length=6)


class CompanyIngestRequest(BaseModel):
    url: str = Field(min_length=1, description="Company website URL to ingest.")
    additional_source_urls: list[str] = Field(
        default_factory=list,
        max_length=MAX_ADDITIONAL_SOURCE_URLS,
        description="Optional same-domain public URLs to prioritize during enrichment.",
    )


class Company(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    canonical_url: str
    normalized_host: str
    source_url: str
    ingest_status: CompanyIngestStatus
    summary: str | None = None
    enrichment: CompanyEnrichment | None = None
    pages: list[CompanyPage] = Field(default_factory=list)
    content_fingerprint: str | None = None
    fetched_at: datetime | None = None
    schema_version: int | None = 1


class CompanyListResponse(BaseModel):
    count: int
    companies: list[Company] = Field(default_factory=list)
