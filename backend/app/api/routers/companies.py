from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import require_api_key
from app.schemas.company import Company, CompanyIngestRequest, CompanyListResponse
from app.services.company_collection import get_company_collection_service
from app.services.company_enrichment import get_company_enrichment_service
from app.services.company_storage import get_company_storage

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/", response_model=CompanyListResponse)
def list_companies() -> CompanyListResponse:
    storage = get_company_storage()
    companies = storage.list_companies()
    return CompanyListResponse(count=len(companies), companies=companies)


@router.post("/ingest", response_model=Company, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_api_key)])
def ingest_company(payload: CompanyIngestRequest) -> Company:
    collection_service = get_company_collection_service()
    enrichment_service = get_company_enrichment_service()
    storage = get_company_storage()

    try:
        collected = collection_service.collect(
            payload.url,
            additional_source_urls=payload.additional_source_urls,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    enrichment = enrichment_service.enrich(collected)
    ingest_status = collected.ingest_status
    if ingest_status == "complete" and enrichment is None:
        ingest_status = "partial"

    return storage.create_company(
        canonical_url=collected.canonical_url,
        normalized_host=collected.normalized_host,
        source_url=collected.source_url,
        ingest_status=ingest_status,
        summary=enrichment.summary if enrichment else None,
        enrichment=enrichment,
        pages=collected.pages,
        content_fingerprint=collected.content_fingerprint,
        fetched_at=collected.fetched_at,
    )


@router.get("/{company_id}", response_model=Company)
def get_company(company_id: str) -> Company:
    storage = get_company_storage()
    company = storage.get_company(company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    return company


@router.post("/{company_id}/refresh", response_model=Company, dependencies=[Depends(require_api_key)])
def refresh_company(company_id: str, payload: CompanyIngestRequest) -> Company:
    collection_service = get_company_collection_service()
    enrichment_service = get_company_enrichment_service()
    storage = get_company_storage()

    company = storage.get_company(company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    try:
        collected = collection_service.collect(
            payload.url,
            additional_source_urls=payload.additional_source_urls,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    enrichment = enrichment_service.enrich(collected)
    ingest_status = collected.ingest_status
    if ingest_status == "complete" and enrichment is None:
        ingest_status = "partial"

    return storage.create_company(
        canonical_url=collected.canonical_url,
        normalized_host=collected.normalized_host,
        source_url=collected.source_url,
        ingest_status=ingest_status,
        summary=enrichment.summary if enrichment else None,
        enrichment=enrichment,
        pages=collected.pages,
        content_fingerprint=collected.content_fingerprint,
        fetched_at=collected.fetched_at,
    )
