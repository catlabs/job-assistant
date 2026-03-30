from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, mapped_column


class Base(DeclarativeBase):
    pass


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobRecord(Base):
    """Persist raw job fields plus an analysis snapshot.

    SQLite dev note: create_all() will not add this column to an existing
    jobs table; deleting backend/job_assistant.db is acceptable locally.
    """

    __tablename__ = "jobs"

    id = mapped_column(String(36), primary_key=True)
    company_id = mapped_column(String(36), nullable=True, index=True)
    title = mapped_column(String(255), nullable=True)
    company = mapped_column(String(255), nullable=True)
    location = mapped_column(String(255), nullable=True)
    url = mapped_column(String(2048), nullable=True)
    source = mapped_column(String(100), nullable=False)
    description = mapped_column(Text, nullable=False)
    analysis_json = mapped_column(Text, nullable=False)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class LlmCallLog(Base):
    __tablename__ = "llm_call_logs"

    id = mapped_column(String(36), primary_key=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, index=True, default=_utc_now)
    operation = mapped_column(String(64), nullable=False, index=True)
    status = mapped_column(String(16), nullable=False, index=True)
    model = mapped_column(String(128), nullable=True)
    prompt_tokens = mapped_column(Integer, nullable=True)
    completion_tokens = mapped_column(Integer, nullable=True)
    total_tokens = mapped_column(Integer, nullable=True)
    job_id = mapped_column(String(36), nullable=True, index=True)
    error_message = mapped_column(String(500), nullable=True)
    extra_json = mapped_column(Text, nullable=True)


class CompanyRecord(Base):
    __tablename__ = "companies"

    id = mapped_column(String(36), primary_key=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, index=True, default=_utc_now)
    updated_at = mapped_column(DateTime(timezone=True), nullable=False, index=True, default=_utc_now)
    canonical_url = mapped_column(String(2048), nullable=False)
    normalized_host = mapped_column(String(255), nullable=False, index=True)
    source_url = mapped_column(String(2048), nullable=False)
    ingest_status = mapped_column(String(32), nullable=False, index=True)
    summary = mapped_column(Text, nullable=True)
    enrichment_json = mapped_column(Text, nullable=True)
    pages_json = mapped_column(Text, nullable=False)
    content_fingerprint = mapped_column(String(128), nullable=True)
    fetched_at = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    schema_version = mapped_column(Integer, nullable=False, default=1)
