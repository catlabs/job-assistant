from __future__ import annotations

from functools import lru_cache
from typing import Literal

import httpx
from openai import APIConnectionError, APIError, APITimeoutError, OpenAI
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.schemas.extract_fields import JobCriteria, SalaryCurrency
from app.services.extraction_models import get_allowed_extraction_models
from app.services.llm_call_logging import _extract_usage_tokens, log_llm_call
from app.services.llm_operations import LlmOperation

MAX_ESTIMATION_INPUT_CHARS = 8_000

SYSTEM_PROMPT = """You estimate compensation for job postings when the posting does not clearly state pay.
Return only valid JSON matching the required schema.
Rules:
- Never treat an estimate as explicit compensation from the posting.
- Be conservative and avoid fake precision.
- You must infer the most likely currency from the job location and market context when it is not explicitly stated.
- For continental European roles, prefer EUR unless there is evidence otherwise.
- For United Kingdom roles, prefer GBP unless there is evidence otherwise.
- For United States roles, prefer USD unless there is evidence otherwise.
- Include the inferred currency in the structured output.
- Mention briefly in basis when the currency was inferred from location or context.
- Use broad plausible ranges anchored in:
  - job title
  - seniority level
  - location
  - employment type / contract type
  - relevant technical scope or skills
  - any meaningful context from the summary
- Prefer nulls when the evidence is too weak.
- confidence must reflect uncertainty conservatively.
- basis must be a short explanation mentioning the main evidence used and any uncertainty.
Output guidance:
- If the role is most likely an employee role, prefer estimated yearly salary fields.
- If the role is most likely a freelance / contractor role, prefer estimated daily rate fields.
- Do not fill both yearly salary and daily rate unless there is a strong reason to do so.
- If the compensation model is ambiguous, choose the most likely one conservatively, or return nulls with low confidence.
Important:
- The estimate is an inference, not a fact from the posting.
- Do not overfit to a single skill keyword.
- Do not produce narrow ranges unless the evidence is unusually strong.
- If location or contract type is unclear, reduce confidence accordingly.
"""


class EstimatedCompensationResponse(BaseModel):
    estimated_salary_min: float | None = None
    estimated_salary_max: float | None = None
    estimated_daily_rate_min: float | None = None
    estimated_daily_rate_max: float | None = None
    estimated_currency: SalaryCurrency = "unknown"
    confidence: Literal["high", "medium", "low", "unknown"] = "unknown"
    basis: str = ""


class CompensationEstimationService:
    def __init__(self) -> None:
        self._client: OpenAI | None = None

    def estimate(self, *, criteria: JobCriteria, raw_text: str, model: str | None = None) -> EstimatedCompensationResponse | None:
        settings = get_settings()
        api_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key else ""
        if not api_key:
            return None

        if self._client is None:
            http_client = httpx.Client(timeout=settings.openai_timeout_seconds)
            self._client = OpenAI(
                api_key=api_key,
                timeout=settings.openai_timeout_seconds,
                http_client=http_client,
            )

        effective_model = model or self._pick_model(settings.openai_model)

        try:
            completion = self._client.beta.chat.completions.parse(
                model=effective_model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": self._build_prompt(criteria=criteria, raw_text=raw_text)},
                ],
                response_format=EstimatedCompensationResponse,
                temperature=0,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                log_llm_call(
                    operation=LlmOperation.ESTIMATE_COMPENSATION,
                    status="error",
                    model=completion.model or effective_model,
                    error_message="Missing parsed compensation estimation response.",
                    job_id=None,
                )
                return None

            result = EstimatedCompensationResponse.model_validate(parsed)
            prompt_tokens, completion_tokens, total_tokens = _extract_usage_tokens(completion.usage)
            log_llm_call(
                operation=LlmOperation.ESTIMATE_COMPENSATION,
                status="success",
                model=completion.model or effective_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                job_id=None,
            )
            return result
        except (APITimeoutError, APIConnectionError, APIError, ValidationError) as exc:
            log_llm_call(
                operation=LlmOperation.ESTIMATE_COMPENSATION,
                status="error",
                model=effective_model,
                error_message=str(exc),
                job_id=None,
            )
            return None

    def _pick_model(self, default_model: str) -> str:
        allowed_models = get_allowed_extraction_models()
        for model in allowed_models:
            if "mini" in model:
                return model
        return default_model

    def _build_prompt(self, *, criteria: JobCriteria, raw_text: str) -> str:
        basics = criteria.job_basics
        technical_skills = ", ".join(skill.name for skill in criteria.technical_signals.skills[:10]) or "unknown"
        financial = criteria.financial_signals
        trimmed_text = raw_text.strip()[:MAX_ESTIMATION_INPUT_CHARS]
        return "\n".join(
            [
                "Estimate likely compensation for this job only because explicit compensation is missing or incomplete.",
                "Return a structured estimate.",
                "The structured output must include the most likely currency even when inferred from location or market context.",
                "",
                "Known job signals:",
                f"- title: {basics.title or 'unknown'}",
                f"- company: {basics.company_name or 'unknown'}",
                f"- location_text: {basics.location_text or 'unknown'}",
                f"- country: {basics.country or 'unknown'}",
                f"- city: {basics.city or 'unknown'}",
                f"- employment_type: {basics.employment_type}",
                f"- contract_type: {basics.contract_type}",
                f"- seniority_level: {basics.seniority_level}",
                f"- work_arrangement: {criteria.personal_life_signals.work_arrangement}",
                f"- technical_skills: {technical_skills}",
                f"- technical_notes: {criteria.technical_signals.technical_notes or 'unknown'}",
                f"- strategic_notes: {criteria.strategic_signals.strategic_notes or 'unknown'}",
                f"- market_value_signal: {criteria.strategic_signals.market_value_signal}",
                f"- financial_currency_hint: {financial.salary_currency}",
                f"- financial_period_hint: {financial.salary_period}",
                f"- financial_notes: {financial.financial_notes or 'unknown'}",
                "",
                "Raw posting excerpt:",
                trimmed_text,
            ]
        )


@lru_cache
def get_compensation_estimation_service() -> CompensationEstimationService:
    return CompensationEstimationService()
