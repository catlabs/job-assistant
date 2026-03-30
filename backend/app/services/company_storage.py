from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select

from app.db.models import CompanyRecord
from app.db.session import get_db_session
from app.schemas.company import Company, CompanyEnrichment, CompanyPage


class CompanyStorage:
    def create_company(
        self,
        *,
        canonical_url: str,
        normalized_host: str,
        source_url: str,
        ingest_status: str,
        summary: str | None,
        enrichment: CompanyEnrichment | None,
        pages: list[CompanyPage],
        content_fingerprint: str | None,
        fetched_at: datetime | None,
        schema_version: int = 1,
    ) -> Company:
        now = datetime.now(timezone.utc)
        with get_db_session() as session:
            record = session.scalar(
                select(CompanyRecord).where(CompanyRecord.canonical_url == canonical_url)
            )

            if record is None:
                record = CompanyRecord(
                    id=str(uuid4()),
                    created_at=now,
                    updated_at=now,
                    canonical_url=canonical_url,
                    normalized_host=normalized_host,
                    source_url=source_url,
                    ingest_status=ingest_status,
                    summary=summary,
                    enrichment_json=enrichment.model_dump_json() if enrichment else None,
                    pages_json=self._pages_to_json(pages),
                    content_fingerprint=content_fingerprint,
                    fetched_at=fetched_at,
                    schema_version=schema_version,
                )
                session.add(record)
            else:
                record.updated_at = now
                record.normalized_host = normalized_host
                record.source_url = source_url
                record.ingest_status = ingest_status
                record.summary = summary
                record.enrichment_json = enrichment.model_dump_json() if enrichment else None
                record.pages_json = self._pages_to_json(pages)
                record.content_fingerprint = content_fingerprint
                record.fetched_at = fetched_at
                record.schema_version = schema_version

            session.commit()
            session.refresh(record)

        return self._to_schema(record)

    def list_companies(self) -> list[Company]:
        with get_db_session() as session:
            records = session.scalars(
                select(CompanyRecord).order_by(CompanyRecord.updated_at.desc(), CompanyRecord.created_at.desc())
            ).all()

        return [self._to_schema(record) for record in records]

    def get_company(self, company_id: str) -> Company | None:
        with get_db_session() as session:
            record = session.get(CompanyRecord, company_id)

        if record is None:
            return None

        return self._to_schema(record)

    def _to_schema(self, record: CompanyRecord) -> Company:
        created_at = self._ensure_utc(record.created_at)
        updated_at = self._ensure_utc(record.updated_at)
        fetched_at = self._ensure_utc(record.fetched_at) if record.fetched_at else None

        return Company(
            id=record.id,
            created_at=created_at,
            updated_at=updated_at,
            canonical_url=record.canonical_url,
            normalized_host=record.normalized_host,
            source_url=record.source_url,
            ingest_status=record.ingest_status,
            summary=record.summary,
            enrichment=CompanyEnrichment.model_validate_json(record.enrichment_json) if record.enrichment_json else None,
            pages=self._pages_from_json(record.pages_json),
            content_fingerprint=record.content_fingerprint,
            fetched_at=fetched_at,
            schema_version=record.schema_version,
        )

    def _ensure_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    def _pages_to_json(self, pages: list[CompanyPage]) -> str:
        return "[" + ",".join(page.model_dump_json() for page in pages) + "]"

    def _pages_from_json(self, payload: str | None) -> list[CompanyPage]:
        if not payload:
            return []
        return [CompanyPage.model_validate(item) for item in json.loads(payload)]


_company_storage = CompanyStorage()


def get_company_storage() -> CompanyStorage:
    return _company_storage
