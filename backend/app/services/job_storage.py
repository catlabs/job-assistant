from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select

from app.db.models import JobRecord
from app.db.session import get_db_session
from app.schemas.job import Job, JobAnalysis, JobCreateRequest
from app.services.job_analysis import analyze_job_posting


class JobStorage:
    """Minimal job storage backed by SQLite via SQLAlchemy."""

    def create_job(self, payload: JobCreateRequest) -> Job:
        analysis = self._build_analysis(
            payload.title,
            payload.company,
            payload.location,
            payload.description,
        )
        record = JobRecord(
            id=str(uuid4()),
            title=payload.title or analysis.normalized_title,
            company=payload.company or analysis.normalized_company,
            location=payload.location or analysis.normalized_location,
            url=payload.url,
            source=payload.source,
            description=payload.description,
            analysis_json=analysis.model_dump_json(),
            created_at=datetime.now(timezone.utc),
        )

        with get_db_session() as session:
            session.add(record)
            session.commit()
            session.refresh(record)

        return self._to_schema(record)

    def list_jobs(self) -> list[Job]:
        with get_db_session() as session:
            records = session.scalars(
                select(JobRecord).order_by(JobRecord.created_at.desc())
            ).all()

        return [self._to_schema(record) for record in records]

    def get_job(self, job_id: str) -> Job | None:
        with get_db_session() as session:
            record = session.get(JobRecord, job_id)

        if record is None:
            return None

        return self._to_schema(record)

    def _to_schema(self, record: JobRecord) -> Job:
        created_at = record.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        return Job(
            id=record.id,
            title=record.title,
            company=record.company,
            location=record.location,
            url=record.url,
            source=record.source,
            description=record.description,
            analysis=self._analysis_from_record(record),
            created_at=created_at,
        )

    def _analysis_from_record(self, record: JobRecord) -> JobAnalysis:
        if not record.analysis_json:
            return JobAnalysis(summary="Analysis unavailable.")

        return JobAnalysis.model_validate_json(record.analysis_json)

    def _build_analysis(
        self,
        title: str | None,
        company: str | None,
        location: str | None,
        description: str,
    ) -> JobAnalysis:
        return JobAnalysis(
            **analyze_job_posting(
                {
                    "title": title,
                    "company": company,
                    "location": location,
                    "description": description,
                }
            )
        )


InMemoryJobStorage = JobStorage

_job_storage = JobStorage()


def get_job_storage() -> JobStorage:
    return _job_storage
