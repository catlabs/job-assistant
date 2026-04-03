from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, cast

from agents import (
    Agent,
    AgentsException,
    ModelBehaviorError,
    ModelSettings,
    Runner,
    set_default_openai_client,
    set_tracing_disabled,
)
from openai import AsyncOpenAI
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.extract_fields import JobCriteria, SalaryCurrency
from app.services.compensation_estimation import EstimatedCompensationResponse, get_compensation_estimation_service
from app.services.llm_call_logging import log_llm_call
from app.services.llm_operations import LlmOperation

MAX_JOB_ANALYSIS_INPUT_CHARS = 12_000

JOB_ANALYSIS_SYSTEM_PROMPT = """You extract structured job criteria from job postings.
Return only valid JSON matching the schema.
Rules:
- Keep claims factual and conservative.
- Use unknown, null, empty string, or [] when the posting does not clearly support a value.
- Do not infer salary, travel, relocation, or seniority more strongly than the text supports.
- Leave financial_signals.estimated_compensation empty; inferred compensation is handled in a separate step.
- For skills, include the main technologies and label importance as required, preferred, or mentioned.
- job_summary should be a concise factual summary of the role.
- For every filled non-unknown / non-null field that is explicitly supported by the posting, provide at least one verbatim quote in that field's matching *_evidence.quotes list.
- Each quote must be copied exactly from the job text apart from trimming surrounding whitespace. Do not paraphrase or summarize inside quotes.
- If support comes from several places, include multiple quotes in the same field evidence list.
- If a value is inferred, weakly supported, or added conservatively, leave its evidence quotes empty. You may add a short rationale only when it clarifies uncertainty.
- Keep evidence concise: no more than 5 quotes per field, and keep each quote short.
- Never include keys that are not defined in the schema.
"""


class JobAnalysisAgentError(Exception):
    def __init__(self, message: str, *, model: str | None = None) -> None:
        super().__init__(message)
        self.model = model


@dataclass(frozen=True)
class JobAnalysisAgentResult:
    criteria: JobCriteria
    model: str
    usage: Any


def run_job_analysis_agent(*, raw_text: str, model: str) -> JobAnalysisAgentResult:
    return _run_async_in_sync_context(_run_job_analysis_agent_async(raw_text=raw_text, model=model))


async def _run_job_analysis_agent_async(*, raw_text: str, model: str) -> JobAnalysisAgentResult:
    settings = get_settings()
    api_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key else ""
    if not api_key:
        raise JobAnalysisAgentError("OpenAI API key is not configured.", model=model)

    # Preserve existing observability behavior and avoid enabling SDK tracing by default.
    set_tracing_disabled(True)
    set_default_openai_client(_get_agents_openai_client(api_key=api_key, timeout_seconds=settings.openai_timeout_seconds))

    agent = _get_job_analysis_agent(model)
    llm_input = raw_text[:MAX_JOB_ANALYSIS_INPUT_CHARS]
    user_prompt = f"Extract criteria from this job posting:\n\n{llm_input}"
    try:
        result = await Runner.run(agent, input=user_prompt)
    except ModelBehaviorError as exc:
        raise JobAnalysisAgentError(str(exc), model=model) from exc
    except AgentsException as exc:
        raise JobAnalysisAgentError(str(exc), model=model) from exc

    parsed = result.final_output
    resolved_model = _resolve_run_model(result=result, fallback_model=model)
    if parsed is None:
        raise JobAnalysisAgentError("Missing parsed extraction response.", model=resolved_model)

    return JobAnalysisAgentResult(
        criteria=JobCriteria.model_validate(cast(Any, parsed)),
        model=resolved_model,
        usage=_resolve_run_usage(result),
    )


@lru_cache
def _get_job_analysis_agent(model: str) -> Agent:
    return Agent(
        name="JobAnalysisAgent",
        instructions=JOB_ANALYSIS_SYSTEM_PROMPT,
        model=model,
        model_settings=ModelSettings(temperature=0),
        output_type=JobCriteria,
    )


@lru_cache
def _get_agents_openai_client(*, api_key: str, timeout_seconds: float) -> AsyncOpenAI:
    return AsyncOpenAI(api_key=api_key, timeout=timeout_seconds)


def _resolve_run_model(*, result: Any, fallback_model: str) -> str:
    raw_responses = getattr(result, "raw_responses", None)
    if not isinstance(raw_responses, list) or not raw_responses:
        return fallback_model
    latest_response = raw_responses[-1]
    resolved_model = getattr(latest_response, "model", None)
    return resolved_model or fallback_model


def _resolve_run_usage(result: Any) -> Any:
    context_wrapper = getattr(result, "context_wrapper", None)
    return getattr(context_wrapper, "usage", None)


def _run_async_in_sync_context(awaitable: Any) -> Any:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(awaitable)

    # If an event loop is already running in this thread, execute in a dedicated
    # worker thread to avoid nested-loop runtime errors.
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(asyncio.run, awaitable)
        return future.result()


def run_market_intelligence_agent(
    *,
    criteria: JobCriteria,
    raw_text: str,
    model: str | None,
) -> EstimatedCompensationResponse | None:
    return get_compensation_estimation_service().estimate(criteria=criteria, raw_text=raw_text, model=model)


def needs_market_intelligence(criteria: JobCriteria) -> bool:
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


def merge_market_enrichment(
    *,
    criteria: JobCriteria,
    market_enrichment: EstimatedCompensationResponse | None,
    model: str | None,
) -> JobCriteria:
    if market_enrichment is None:
        return criteria

    updated = criteria.model_copy(deep=True)
    try:
        updated.financial_signals.estimated_compensation = (
            updated.financial_signals.estimated_compensation.model_validate(market_enrichment.model_dump())
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
