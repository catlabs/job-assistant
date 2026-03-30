from __future__ import annotations

import json
from functools import lru_cache

import httpx
from openai import APIConnectionError, APIError, APITimeoutError, OpenAI
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings
from app.schemas.company import CompanyEnrichment
from app.services.company_collection import CollectedCompanyData
from app.services.llm_call_logging import _extract_usage_tokens, log_llm_call
from app.services.llm_operations import LlmOperation

SYSTEM_PROMPT = """You summarize company website evidence into compact structured context.
Return only valid JSON matching the schema.
Rules:
- Use only the collected evidence.
- Do not speculate beyond the provided text.
- Explicitly mention uncertainty when evidence is weak, missing, or ambiguous.
- Keep lists concise and factual.
- summary must be 1 to 3 short sentences.
"""


class CompanyEnrichmentResponse(BaseModel):
    summary: str = ""
    product_or_domain_signals: list[str] = Field(default_factory=list, max_length=6)
    hiring_or_team_signals: list[str] = Field(default_factory=list, max_length=6)
    maturity_or_stage_signals: list[str] = Field(default_factory=list, max_length=6)
    risk_flags_or_unknowns: list[str] = Field(default_factory=list, max_length=6)
    source_urls_used: list[str] = Field(default_factory=list, max_length=6)


class CompanyEnrichmentService:
    def __init__(self) -> None:
        self._client: OpenAI | None = None

    def enrich(self, collected: CollectedCompanyData) -> CompanyEnrichment | None:
        if not collected.combined_text.strip():
            return None

        settings = get_settings()
        api_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key else ""
        if not api_key:
            return self._fallback_enrichment(collected)

        if self._client is None:
            http_client = httpx.Client(timeout=settings.openai_timeout_seconds)
            self._client = OpenAI(
                api_key=api_key,
                timeout=settings.openai_timeout_seconds,
                http_client=http_client,
            )

        prompt = self._build_prompt(collected)
        log_metadata = json.dumps(
            {
                "source_url": collected.source_url,
                "canonical_url": collected.canonical_url,
                "normalized_host": collected.normalized_host,
            }
        )

        try:
            completion = self._client.beta.chat.completions.parse(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                response_format=CompanyEnrichmentResponse,
                temperature=0,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                log_llm_call(
                    operation=LlmOperation.COMPANY_ENRICHMENT,
                    status="error",
                    model=completion.model or settings.openai_model,
                    error_message="Missing parsed company enrichment response.",
                    extra_json=log_metadata,
                )
                return self._fallback_enrichment(collected)

            result = CompanyEnrichmentResponse.model_validate(parsed)
            prompt_tokens, completion_tokens, total_tokens = _extract_usage_tokens(completion.usage)
            log_llm_call(
                operation=LlmOperation.COMPANY_ENRICHMENT,
                status="success",
                model=completion.model or settings.openai_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                extra_json=log_metadata,
            )
            return CompanyEnrichment.model_validate(result.model_dump())
        except (APITimeoutError, APIConnectionError, APIError, ValidationError) as exc:
            log_llm_call(
                operation=LlmOperation.COMPANY_ENRICHMENT,
                status="error",
                model=settings.openai_model,
                error_message=str(exc),
                extra_json=log_metadata,
            )
            return self._fallback_enrichment(collected)

    def _build_prompt(self, collected: CollectedCompanyData) -> str:
        page_lines = [
            f"- {page.path} | title={page.title or ''} | url={page.url}"
            for page in collected.pages
        ]
        return "\n".join(
            [
                "Build compact company context from this bounded site sample.",
                "Output requirements:",
                "- summary: 1 to 3 short factual sentences.",
                "- product_or_domain_signals: up to 6 concise strings.",
                "- hiring_or_team_signals: up to 6 concise strings.",
                "- maturity_or_stage_signals: up to 6 concise strings.",
                "- risk_flags_or_unknowns: up to 6 concise strings, emphasizing missing or uncertain context.",
                "- source_urls_used: include only URLs from the provided page list.",
                "",
                f"Source URL: {collected.source_url}",
                f"Canonical URL: {collected.canonical_url}",
                f"Normalized host: {collected.normalized_host}",
                "Pages:",
                *page_lines,
                "",
                "Collected text:",
                collected.combined_text,
            ]
        )

    def _fallback_enrichment(self, collected: CollectedCompanyData) -> CompanyEnrichment:
        source_urls = [page.url for page in collected.pages[:6]]
        if collected.pages:
            titles = [page.title.strip() for page in collected.pages if page.title and page.title.strip()]
            summary = (
                f"Collected {len(collected.pages)} same-domain page(s) from {collected.normalized_host}. "
                "Structured enrichment is limited, so this summary should be treated as partial."
            )
            risk_flags = ["LLM enrichment unavailable; review source pages directly for fuller context."]
            if not titles:
                risk_flags.append("Page titles were weak or missing, so company identity remains uncertain.")
            return CompanyEnrichment(
                summary=summary,
                product_or_domain_signals=titles[:3],
                hiring_or_team_signals=[],
                maturity_or_stage_signals=[],
                risk_flags_or_unknowns=risk_flags[:6],
                source_urls_used=source_urls,
            )

        return CompanyEnrichment(
            summary="No usable same-domain pages were collected, so company context remains unavailable.",
            product_or_domain_signals=[],
            hiring_or_team_signals=[],
            maturity_or_stage_signals=[],
            risk_flags_or_unknowns=["Collection failed or returned no usable text."],
            source_urls_used=source_urls,
        )


@lru_cache
def get_company_enrichment_service() -> CompanyEnrichmentService:
    return CompanyEnrichmentService()
