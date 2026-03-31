from functools import lru_cache

import httpx
from fastapi import HTTPException, status
from openai import APIConnectionError, APIError, APITimeoutError, OpenAI
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.extract_fields import ExtractFieldsRequest, ExtractFieldsResponse, JobCriteria, SalaryCurrency
from app.services.compensation_estimation import get_compensation_estimation_service
from app.services.job_criteria import build_job_criteria
from app.services.llm_call_logging import _extract_usage_tokens, log_llm_call
from app.services.llm_operations import LlmOperation

MAX_LLM_INPUT_CHARS = 12_000

SYSTEM_PROMPT = """You extract structured job criteria from job postings.
Return only valid JSON matching the schema.
Rules:
- Keep claims factual and conservative.
- Use unknown, null, empty string, or [] when the posting does not clearly support a value.
- Do not infer salary, travel, relocation, or seniority more strongly than the text supports.
- Leave financial_signals.estimated_compensation empty; inferred compensation is handled in a separate step.
- For skills, include the main technologies and label importance as required, preferred, or mentioned.
- job_summary should be a concise factual summary of the role.
- Never include keys that are not defined in the schema.
"""


class JobFieldExtractionService:
    def __init__(self) -> None:
        self._client: OpenAI | None = None

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

        if self._client is None:
            # openai==1.51.x is not compatible with httpx 0.28's removed "proxies" arg
            # when using its default internal client wrapper.
            http_client = httpx.Client(timeout=settings.openai_timeout_seconds)
            self._client = OpenAI(
                api_key=api_key,
                timeout=settings.openai_timeout_seconds,
                http_client=http_client,
            )

        llm_input = payload.raw_text[:MAX_LLM_INPUT_CHARS]
        user_prompt = f"Extract criteria from this job posting:\n\n{llm_input}"
        effective_model = payload.model or settings.openai_model

        try:
            completion = self._client.beta.chat.completions.parse(
                model=effective_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=JobCriteria,
                temperature=0,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                log_llm_call(
                    operation=LlmOperation.EXTRACT_FIELDS,
                    status="error",
                    model=completion.model or effective_model,
                    error_message="Missing parsed extraction response.",
                    job_id=None,
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="LLM did not return structured extraction output.",
                )

            criteria = build_job_criteria(
                title=parsed.job_basics.title or None,
                company=parsed.job_basics.company_name or None,
                location=parsed.job_basics.location_text or None,
                description=payload.raw_text,
                base_criteria=JobCriteria.model_validate(parsed),
            )
            criteria = self._apply_compensation_estimate(
                criteria=criteria,
                raw_text=payload.raw_text,
                model=payload.model,
            )
            prompt_tokens, completion_tokens, total_tokens = _extract_usage_tokens(completion.usage)
            log_llm_call(
                operation=LlmOperation.EXTRACT_FIELDS,
                status="success",
                model=completion.model or effective_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                job_id=None,
            )
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

    def _apply_compensation_estimate(
        self,
        *,
        criteria: JobCriteria,
        raw_text: str,
        model: str | None,
    ) -> JobCriteria:
        if not _should_estimate_compensation(criteria):
            return criteria

        estimate = get_compensation_estimation_service().estimate(
            criteria=criteria,
            raw_text=raw_text,
            model=model,
        )
        if estimate is None:
            return criteria

        updated = criteria.model_copy(deep=True)
        try:
            updated.financial_signals.estimated_compensation = (
                updated.financial_signals.estimated_compensation.model_validate(estimate.model_dump())
            )
        except ValidationError as exc:
            log_llm_call(
                operation=LlmOperation.ESTIMATE_COMPENSATION,
                status="error",
                model=model or get_settings().openai_model,
                error_message=f"Failed to map compensation estimate: {exc}",
                job_id=None,
            )
            return criteria
        updated = _normalize_estimated_compensation(updated)
        if _has_estimated_compensation(updated):
            updated.extraction_quality.missing_critical_information = [
                item for item in updated.extraction_quality.missing_critical_information if item != "compensation"
            ]
            if (
                updated.financial_signals.financial_clarity == "low"
                and updated.financial_signals.estimated_compensation.confidence in {"high", "medium"}
            ):
                updated.financial_signals.financial_clarity = "medium"
            ambiguity_notes = updated.extraction_quality.ambiguity_notes.strip()
            estimate_note = "Compensation is estimated rather than stated explicitly."
            if estimate_note not in ambiguity_notes:
                updated.extraction_quality.ambiguity_notes = (
                    f"{ambiguity_notes} {estimate_note}".strip() if ambiguity_notes else estimate_note
                )
        return updated


@lru_cache
def get_job_field_extraction_service() -> JobFieldExtractionService:
    return JobFieldExtractionService()


def _should_estimate_compensation(criteria: JobCriteria) -> bool:
    financial = criteria.financial_signals
    has_explicit_salary_range = financial.salary_min is not None and (
        financial.salary_max is not None or financial.salary_period != "unknown"
    )
    has_explicit_daily_rate_range = financial.daily_rate_min is not None and financial.daily_rate_max is not None
    if has_explicit_salary_range or has_explicit_daily_rate_range:
        return False

    has_any_explicit_amount = any(
        value is not None
        for value in (
            financial.salary_min,
            financial.salary_max,
            financial.daily_rate_min,
            financial.daily_rate_max,
        )
    )
    if not has_any_explicit_amount:
        return True

    # Still estimate when compensation exists only as a fragment that is not yet useful for display.
    return financial.salary_currency == "unknown" or financial.salary_period == "unknown"


def _has_estimated_compensation(criteria: JobCriteria) -> bool:
    estimated = criteria.financial_signals.estimated_compensation
    return any(
        value is not None
        for value in (
            estimated.estimated_salary_min,
            estimated.estimated_salary_max,
            estimated.estimated_daily_rate_min,
            estimated.estimated_daily_rate_max,
        )
    )


def _normalize_estimated_compensation(criteria: JobCriteria) -> JobCriteria:
    estimated = criteria.financial_signals.estimated_compensation
    if estimated.estimated_currency != "unknown":
        return criteria

    inferred_currency = _infer_estimated_currency(criteria)
    if inferred_currency == "unknown":
        return criteria

    estimated.estimated_currency = inferred_currency
    if estimated.basis:
        lowered_basis = estimated.basis.lower()
        if "currency" not in lowered_basis and inferred_currency.lower() not in lowered_basis:
            estimated.basis = f"{estimated.basis} Currency inferred as {inferred_currency} from location/context."
    else:
        estimated.basis = f"Currency inferred as {inferred_currency} from location/context."
    return criteria


def _infer_estimated_currency(criteria: JobCriteria) -> SalaryCurrency:
    if criteria.financial_signals.salary_currency != "unknown":
        return criteria.financial_signals.salary_currency

    basics = criteria.job_basics
    location_haystack = " " + " ".join(
        value.lower()
        for value in (basics.country, basics.city, basics.location_text)
        if value
    ) + " "

    if any(token in location_haystack for token in ("united kingdom", "uk", "london", "england", "scotland", "wales")):
        return "GBP"
    if any(token in location_haystack for token in ("united states", " usa ", " us ", "new york", "san francisco", "seattle", "boston")):
        return "USD"
    if any(
        token in location_haystack
        for token in (
            "belgium",
            "belgique",
            "belgie",
            "netherlands",
            "france",
            "luxembourg",
            "germany",
            "ireland",
            "spain",
            "portugal",
            "belgian",
            "dutch",
            "french",
            "german",
            "irish",
            "spanish",
            "portuguese",
            "brussels",
            "bruxelles",
            "brussel",
            "antwerp",
            "antwerpen",
            "ghent",
            "gent",
            "leuven",
            "amsterdam",
            "rotterdam",
            "paris",
            "lille",
            "berlin",
            "munich",
            "dublin",
            "madrid",
            "barcelona",
            "lisbon",
            "porto",
        )
    ):
        return "EUR"
    return "unknown"
