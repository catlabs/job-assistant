from fastapi import APIRouter, HTTPException, status

from app.core.config import get_settings
from app.schemas.extract_fields import (
    ExtractFieldsRequest,
    ExtractFieldsResponse,
    ExtractionModelsResponse,
)
from app.schemas.job import Job, JobCreateRequest, JobListResponse
from app.services.extraction_models import get_allowed_extraction_models
from app.services.job_field_extraction import get_job_field_extraction_service
from app.services.job_storage import get_job_storage

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/", response_model=Job, status_code=status.HTTP_201_CREATED)
def create_job(payload: JobCreateRequest) -> Job:
    storage = get_job_storage()
    return storage.create_job(payload)


@router.get("/", response_model=JobListResponse)
def list_jobs() -> JobListResponse:
    storage = get_job_storage()
    jobs = storage.list_jobs()
    return JobListResponse(count=len(jobs), jobs=jobs)


@router.post("/extract-fields", response_model=ExtractFieldsResponse)
def extract_job_fields(payload: ExtractFieldsRequest) -> ExtractFieldsResponse:
    service = get_job_field_extraction_service()
    return service.extract_fields(payload)


@router.get("/extraction-models", response_model=ExtractionModelsResponse)
def list_extraction_models() -> ExtractionModelsResponse:
    settings = get_settings()
    models = get_allowed_extraction_models()
    return ExtractionModelsResponse(default_model=settings.openai_model, models=models)


@router.get("/{job_id}", response_model=Job)
def get_job(job_id: str) -> Job:
    storage = get_job_storage()
    job = storage.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return job
