from functools import lru_cache

from fastapi import HTTPException, status
from openai import APIConnectionError, APIError, APITimeoutError
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.extract_fields import ExtractFieldsRequest, ExtractFieldsResponse, JobCriteria
from app.services.job_extraction_agents import (
    JobAnalysisAgentError,
    merge_market_enrichment,
    needs_market_intelligence,
    run_job_analysis_agent,
    run_market_intelligence_agent,
)
from app.services.job_criteria import build_job_criteria
from app.services.llm_call_logging import _extract_usage_tokens, log_llm_call
from app.services.llm_operations import LlmOperation


class JobFieldExtractionService:
    def extract_fields(self, payload: ExtractFieldsRequest) -> ExtractFieldsResponse:
        settings = get_settings()
        api_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key else ""
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "OpenAI API key is not configured. "
                    "Set JOB_ASSISTANT_OPENAI_API_KEY in backend/.env."
                ),
            )

        effective_model = payload.model or settings.openai_model

        try:
            # Agent 1: extract structured criteria directly from raw text.
            job_analysis_result = run_job_analysis_agent(
                raw_text=payload.raw_text,
                model=effective_model,
            )
            # Deterministic normalization core.
            criteria = build_job_criteria(
                title=job_analysis_result.criteria.job_basics.title or None,
                company=job_analysis_result.criteria.job_basics.company_name or None,
                location=job_analysis_result.criteria.job_basics.location_text or None,
                description=payload.raw_text,
                base_criteria=job_analysis_result.criteria,
            )
            # Deterministic evidence policy.
            criteria = _validate_evidence_quotes(criteria=criteria, raw_text=payload.raw_text)
            # Agent 2: market intelligence enrichment, only when policy allows it.
            if needs_market_intelligence(criteria):
                market_enrichment = run_market_intelligence_agent(
                    criteria=criteria,
                    raw_text=payload.raw_text,
                    model=payload.model,
                )
                # Deterministic merge policy.
                criteria = merge_market_enrichment(
                    criteria=criteria,
                    market_enrichment=market_enrichment,
                    model=payload.model,
                )

            prompt_tokens, completion_tokens, total_tokens = _extract_usage_tokens(job_analysis_result.usage)
            log_llm_call(
                operation=LlmOperation.EXTRACT_FIELDS,
                status="success",
                model=job_analysis_result.model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                job_id=None,
            )
        except JobAnalysisAgentError as exc:
            log_llm_call(
                operation=LlmOperation.EXTRACT_FIELDS,
                status="error",
                model=exc.model or effective_model,
                error_message=str(exc),
                job_id=None,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LLM did not return structured extraction output.",
            ) from exc
        except APITimeoutError as exc:
            log_llm_call(
                operation=LlmOperation.EXTRACT_FIELDS,
                status="error",
                model=effective_model,
                error_message=str(exc),
                job_id=None,
            )
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Timed out while extracting fields with the LLM.",
            ) from exc
        except (APIConnectionError, APIError) as exc:
            log_llm_call(
                operation=LlmOperation.EXTRACT_FIELDS,
                status="error",
                model=effective_model,
                error_message=str(exc),
                job_id=None,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenAI request failed while extracting job fields.",
            ) from exc
        except ValidationError as exc:
            log_llm_call(
                operation=LlmOperation.EXTRACT_FIELDS,
                status="error",
                model=effective_model,
                error_message=str(exc),
                job_id=None,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LLM returned invalid extraction JSON.",
            ) from exc

        return ExtractFieldsResponse(raw_text=payload.raw_text, criteria=criteria)


@lru_cache
def get_job_field_extraction_service() -> JobFieldExtractionService:
    return JobFieldExtractionService()


def _validate_evidence_quotes(*, criteria: JobCriteria, raw_text: str) -> JobCriteria:
    updated = criteria.model_copy(deep=True)
    raw_text_variants = {raw_text, raw_text.lower(), " ".join(raw_text.split()), " ".join(raw_text.split()).lower()}

    for model in (
        updated.job_basics,
        updated.technical_signals,
        updated.personal_life_signals,
        updated.financial_signals,
        updated.strategic_signals,
    ):
        for field_name, field_value in model:
            if not field_name.endswith("_evidence"):
                continue
            valid_quotes = [
                quote for quote in field_value.quotes if _quote_in_raw_text(quote=quote, raw_text_variants=raw_text_variants)
            ]
            field_value.quotes = valid_quotes
            if not valid_quotes and not field_value.rationale:
                field_value.rationale = None

    return updated


def _quote_in_raw_text(*, quote: str, raw_text_variants: set[str]) -> bool:
    normalized_quote = quote.strip()
    if not normalized_quote:
        return False

    collapsed_quote = " ".join(normalized_quote.split())
    candidates = {
        normalized_quote,
        normalized_quote.lower(),
        collapsed_quote,
        collapsed_quote.lower(),
    }
    return any(candidate and candidate in raw_text for candidate in candidates for raw_text in raw_text_variants)
