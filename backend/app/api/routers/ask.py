from fastapi import APIRouter, HTTPException, status

from app.schemas.ask import AskRequest, AskResponse
from app.services.ask_service import get_ask_service
from app.services.job_storage import get_job_storage

router = APIRouter(prefix="/ask", tags=["ask"])


@router.post("/", response_model=AskResponse)
def ask_question(payload: AskRequest) -> AskResponse:
    storage = get_job_storage()
    if payload.job_id and storage.get_job(payload.job_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    service = get_ask_service()
    return service.answer(payload)
