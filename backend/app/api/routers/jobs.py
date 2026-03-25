from fastapi import APIRouter, HTTPException, status

from app.schemas.job import Job, JobCreateRequest, JobListResponse
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


@router.get("/{job_id}", response_model=Job)
def get_job(job_id: str) -> Job:
    storage = get_job_storage()
    job = storage.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return job
