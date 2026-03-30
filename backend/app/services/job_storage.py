from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select

from app.db.models import JobRecord
from app.db.session import get_db_session
from app.schemas.job import Job, JobAnalysis, JobCreateRequest
from app.services.extraction_fit_cache import get_extraction_fit_cache
from app.services.job_analysis import analyze_job_posting
from app.services.job_fit_assessment import get_job_fit_assessment_service
from app.services.job_signal_extraction import derive_work_arrangement, extract_compensation_display
from app.services.llm_call_logging import bind_extraction_logs_to_job
from app.services.text_fingerprint import fingerprint_text


class JobStorage:
    """Minimal job storage backed by SQLite via SQLAlchemy."""

    def create_job(self, payload: JobCreateRequest) -> Job:
        job_id = str(uuid4())
        analysis = self._build_analysis(
            payload.title,
            payload.company,
            payload.location,
            payload.description,
            payload.extraction_ref,
            job_id=job_id,
        )
        record = JobRecord(
            id=job_id,
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

        analysis = JobAnalysis.model_validate_json(record.analysis_json)
        if analysis.work_arrangement == "unknown":
            analysis.work_arrangement = derive_work_arrangement(
                record.title,
                record.location,
                record.description,
            )
        if not analysis.compensation_display:
            analysis.compensation_display = extract_compensation_display(record.description)
        return analysis

    def _build_analysis(
        self,
        title: str | None,
        company: str | None,
        location: str | None,
        description: str,
        extraction_ref: str | None,
        *,
        job_id: str | None = None,
    ) -> JobAnalysis:
        if extraction_ref and job_id:
            bind_extraction_logs_to_job(extraction_ref=extraction_ref, job_id=job_id)

        analysis = JobAnalysis(
            **analyze_job_posting(
                {
                    "title": title,
                    "company": company,
                    "location": location,
                    "description": description,
                }
            )
        )

        cached_fit = None
        profile_context_fingerprint = (
            get_job_fit_assessment_service().get_profile_context_fingerprint() if extraction_ref else ""
        )
        if extraction_ref:
            # Reuse fit from extraction only when ref and description fingerprint still match.
            cached_fit = get_extraction_fit_cache().get_matching(
                extraction_ref=extraction_ref,
                text_fingerprint=fingerprint_text(description),
                profile_context_fingerprint=profile_context_fingerprint,
            )

        if cached_fit is not None:
            analysis.fit_classification = cached_fit.fit_classification
            analysis.fit_rationale = cached_fit.fit_rationale
            analysis.decision = cached_fit.decision
            analysis.dimension_assessment = cached_fit.dimension_assessment
            analysis.decision_v2 = cached_fit.decision_v2
            return analysis

        fit_result = get_job_fit_assessment_service().assess_job_fit(
            title=title,
            company=company,
            location=location,
            description=description,
            job_id=job_id,
        )
        analysis.fit_classification = fit_result.fit_classification
        analysis.fit_rationale = fit_result.fit_rationale
        analysis.decision = fit_result.decision
        analysis.dimension_assessment = fit_result.dimension_assessment
        analysis.decision_v2 = fit_result.decision_v2
        return analysis


InMemoryJobStorage = JobStorage

_job_storage = JobStorage()


def get_job_storage() -> JobStorage:
    return _job_storage
