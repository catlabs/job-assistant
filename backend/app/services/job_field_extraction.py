from functools import lru_cache
from uuid import uuid4

import httpx
from fastapi import HTTPException, status
from openai import APIConnectionError, APIError, APITimeoutError, OpenAI
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.extract_fields import ExtractFieldsRequest, ExtractFieldsResponse, ExtractedJobFields
from app.services.extraction_fit_cache import get_extraction_fit_cache
from app.services.job_fit_assessment import get_job_fit_assessment_service
from app.services.text_fingerprint import fingerprint_text

MAX_LLM_INPUT_CHARS = 12_000

SYSTEM_PROMPT = """You extract structured job fields from job postings.
Return only valid JSON matching the schema.
Rules:
- title: actual job title, else empty string
- company: company name only, else empty string
- location: most precise location available, else empty string
- seniority: exactly one of Intern, Junior, Mid, Senior, Lead, Staff, or empty string
- summary: 1 to 3 concise factual sentences, else empty string
- keywords: up to 8 normalized relevant items, else []
- Never include keys not defined in the schema
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
        user_prompt = f"Extract fields from this job posting:\n\n{llm_input}"

        try:
            completion = self._client.beta.chat.completions.parse(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=ExtractedJobFields,
                temperature=0,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="LLM did not return structured extraction output.",
                )
            extracted = ExtractedJobFields.model_validate(parsed)
        except APITimeoutError as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Timed out while extracting fields with the LLM.",
            ) from exc
        except (APIConnectionError, APIError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenAI request failed while extracting job fields.",
            ) from exc
        except ValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LLM returned invalid extraction JSON.",
            ) from exc

        fit_result = get_job_fit_assessment_service().assess_job_fit(
            title=extracted.title or None,
            company=extracted.company or None,
            location=extracted.location or None,
            description=payload.raw_text,
        )
        extraction_ref = str(uuid4())
        get_extraction_fit_cache().put(
            extraction_ref=extraction_ref,
            text_fingerprint=fingerprint_text(payload.raw_text),
            fit_classification=fit_result.fit_classification,
            fit_rationale=fit_result.fit_rationale,
        )

        return ExtractFieldsResponse(
            raw_text=payload.raw_text,
            extraction_ref=extraction_ref,
            fit_classification=fit_result.fit_classification,
            fit_rationale=fit_result.fit_rationale,
            **extracted.model_dump(),
        )


@lru_cache
def get_job_field_extraction_service() -> JobFieldExtractionService:
    return JobFieldExtractionService()
