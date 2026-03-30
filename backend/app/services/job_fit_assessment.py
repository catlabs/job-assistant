import re
from functools import lru_cache
from typing import Any, Literal

import httpx
from openai import APIConnectionError, APIError, APITimeoutError, OpenAI
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings
from app.schemas.job import DecisionAnalysisV2, JobDecisionV1, JobDimensionAssessment
from app.services.compensation_normalization import build_comparison_hint, normalize_compensation
from app.services.job_signal_extraction import (
    JobLifestyleSignals,
    LifestylePreassessment,
    derive_lifestyle_preassessment,
    extract_compensation_display,
    extract_lifestyle_signals,
)
from app.services.profile_assessment_context import (
    build_profile_assessment_context,
    build_profile_context_fingerprint,
)
from app.services.llm_call_logging import _extract_usage_tokens, log_llm_call
from app.services.llm_operations import LlmOperation
from app.services.profile_loader import load_user_profile

MAX_JOB_DESCRIPTION_CHARS = 6_000


class DecisionAssessmentResponse(BaseModel):
    headline: str
    detail: str
    risk_flags: list[str] = Field(default_factory=list, max_length=4)
    clarifying_questions: list[str] = Field(default_factory=list, max_length=3)


class CombinedAssessmentResponse(BaseModel):
    fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"]
    fit_rationale: str
    decision: DecisionAssessmentResponse
    dimension_assessment: JobDimensionAssessment | None = None
    decision_v2: DecisionAnalysisV2 | None = None


class JobFitAssessmentResult(BaseModel):
    fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"] | None = None
    fit_rationale: str = ""
    decision: JobDecisionV1 | None = None
    dimension_assessment: JobDimensionAssessment | None = None
    decision_v2: DecisionAnalysisV2 | None = None
    profile_context_fingerprint: str = ""


class JobFitAssessmentService:
    def __init__(self) -> None:
        self._client: OpenAI | None = None

    def assess_job_fit(
        self,
        *,
        title: str | None,
        company: str | None,
        location: str | None,
        description: str,
        job_id: str | None = None,
        extra_json: str | None = None,
    ) -> JobFitAssessmentResult:
        settings = get_settings()
        api_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key else ""
        if not api_key:
            return JobFitAssessmentResult()

        profile_context = build_profile_assessment_context(load_user_profile())
        if profile_context is None:
            return JobFitAssessmentResult()
        profile_context_fingerprint = build_profile_context_fingerprint(profile_context)

        if self._client is None:
            # openai==1.51.x is not compatible with httpx 0.28's removed "proxies" arg
            # when using its default internal client wrapper.
            http_client = httpx.Client(timeout=settings.openai_timeout_seconds)
            self._client = OpenAI(
                api_key=api_key,
                timeout=settings.openai_timeout_seconds,
                http_client=http_client,
            )

        user_decision_context = profile_context.get("user_decision_context") or {}
        lifestyle_signals = extract_lifestyle_signals(
            title=title,
            location=location,
            description=description,
        )
        lifestyle_preassessment = derive_lifestyle_preassessment(
            signals=lifestyle_signals,
            location_preferences=user_decision_context.get("location_preferences"),
        )
        job_compensation_signal = self._extract_job_compensation_signal(description)
        comparison_hint = self._build_compensation_comparison_hint(
            user_decision_context=user_decision_context,
            job_compensation_signal=job_compensation_signal,
        )
        prompt = self._build_prompt(
            profile_context=profile_context,
            title=title,
            company=company,
            location=location,
            description=description,
            job_compensation_signal=job_compensation_signal,
            comparison_hint=comparison_hint,
            lifestyle_signals=lifestyle_signals,
            lifestyle_preassessment=lifestyle_preassessment,
        )

        try:
            completion = self._client.beta.chat.completions.parse(
                model=settings.openai_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You assess job fit and provide concise decision support for a specific profile. "
                            "Return only valid JSON matching the response schema."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format=CombinedAssessmentResponse,
                temperature=0,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                log_llm_call(
                    operation=LlmOperation.JOB_FIT_ASSESSMENT,
                    status="error",
                    model=completion.model or settings.openai_model,
                    error_message="Missing parsed fit assessment response.",
                    job_id=job_id,
                    extra_json=extra_json,
                )
                return JobFitAssessmentResult()
            result = CombinedAssessmentResponse.model_validate(parsed)
            prompt_tokens, completion_tokens, total_tokens = _extract_usage_tokens(completion.usage)
            log_llm_call(
                operation=LlmOperation.JOB_FIT_ASSESSMENT,
                status="success",
                model=completion.model or settings.openai_model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                job_id=job_id,
                extra_json=extra_json,
            )
        except (APITimeoutError, APIConnectionError, APIError, ValidationError) as exc:
            log_llm_call(
                operation=LlmOperation.JOB_FIT_ASSESSMENT,
                status="error",
                model=settings.openai_model,
                error_message=str(exc),
                job_id=job_id,
                extra_json=extra_json,
            )
            return JobFitAssessmentResult()

        return JobFitAssessmentResult(
            fit_classification=result.fit_classification,
            fit_rationale=result.fit_rationale.strip(),
            decision=JobDecisionV1(
                headline=result.decision.headline.strip(),
                detail=result.decision.detail.strip(),
                risk_flags=[item.strip() for item in result.decision.risk_flags if item.strip()][:4],
                clarifying_questions=[
                    item.strip() for item in result.decision.clarifying_questions if item.strip()
                ][:3],
            ),
            dimension_assessment=self._resolve_dimension_assessment(
                llm_assessment=result.dimension_assessment,
                fit_classification=result.fit_classification,
                comparison_hint=comparison_hint,
                lifestyle_preassessment=lifestyle_preassessment,
            ),
            decision_v2=result.decision_v2,
            profile_context_fingerprint=profile_context_fingerprint,
        )

    def get_profile_context_fingerprint(self) -> str:
        profile_context = build_profile_assessment_context(load_user_profile())
        if profile_context is None:
            return ""
        return build_profile_context_fingerprint(profile_context)

    def _build_prompt(
        self,
        *,
        profile_context: dict[str, Any],
        title: str | None,
        company: str | None,
        location: str | None,
        description: str,
        job_compensation_signal: dict[str, Any],
        comparison_hint: dict[str, str],
        lifestyle_signals: JobLifestyleSignals,
        lifestyle_preassessment: LifestylePreassessment,
    ) -> str:
        user_decision_context = profile_context.get("user_decision_context") or {}

        lines = [
            "Assess this job as a real decision, not as a generic summary.",
            f"Allowed labels: {', '.join(profile_context['labels'])}",
            "Overall decision priorities:",
            "- strategic alignment toward AI/product engineering, LLM-enabled product work, ownership, and end-to-end scope",
            "- financial alignment versus the user's baseline when compensation data exists",
            "- lifestyle feasibility from Belgium based on location, work mode, travel, and relocation requirements",
            "Job fit model signals:",
            f"- strong_fit_signals: {profile_context['strong_fit_signals']}",
            f"- acceptable_but_intermediate_signals: {profile_context['acceptable_signals']}",
            f"- misaligned_signals: {profile_context['misaligned_signals']}",
            "Dimension rubric:",
            "- strategic_fit must be exactly one of: high, medium, low",
            "- strategic_fit is high only when the role clearly advances AI/product engineering direction, ownership, or transversal scope",
            "- strategic_fit should be low for pure frontend, narrow execution, no-ownership, or annotation/evaluation-only work",
            "- financial_fit must be exactly one of: upgrade, neutral, downgrade, unknown",
            "- financial_fit should use the user's baseline and compensation comparison hint; use unknown when data is insufficient",
            "- lifestyle_fit must be exactly one of: compatible, constrained, incompatible, unknown",
            "- lifestyle_fit must reflect practical feasibility more than employer preference",
            "- If the job indicates relocation outside Belgium, fully onsite work, or travel above 20%, treat lifestyle_fit as incompatible unless the text clearly contradicts that signal",
            "Overall classification rubric:",
            "- strong_fit only when the role is clearly compelling overall and does not have a major blocker",
            "- misaligned when there is a clear blocker or a strong strategic mismatch",
            "- acceptable_intermediate when the job is viable but mixed, partial, compromised, or uncertain",
        ]
        if profile_context["interpretation_rules"]:
            lines.append(f"Interpretation guidance: {profile_context['interpretation_rules']}")
        if profile_context["decision_dimensions"]:
            lines.append(f"Decision dimensions to consider when relevant: {profile_context['decision_dimensions']}")
        lines.extend(
            [
                "",
                "User decision context:",
                f"- profile_summary: {user_decision_context.get('profile_summary') or '(none)'}",
                f"- financial_baseline: {user_decision_context.get('financial_baseline') or '(none)'}",
                f"- strategic_preferences: {user_decision_context.get('strategic_preferences') or '(none)'}",
                f"- location_preferences: {user_decision_context.get('location_preferences') or '(none)'}",
                "",
                "Structured job signals:",
                f"- work_arrangement_signal: {lifestyle_signals.work_arrangement}",
                f"- location_category_signal: {lifestyle_signals.location_category}",
                f"- relocation_required_signal: {lifestyle_signals.relocation_required}",
                f"- onsite_days_per_week_signal: {lifestyle_signals.onsite_days_per_week}",
                f"- onsite_days_per_period_signal: {lifestyle_signals.onsite_days_per_period}",
                f"- onsite_period_weeks_signal: {lifestyle_signals.onsite_period_weeks}",
                f"- travel_requirement_percent_signal: {lifestyle_signals.travel_requirement_percent}",
                f"- lifestyle_signal_summary: {lifestyle_signals.signal_summary}",
                f"- lifestyle_preassessment: {lifestyle_preassessment.lifestyle_fit}",
                f"- lifestyle_preassessment_rationale: {lifestyle_preassessment.rationale or '(none)'}",
                f"- lifestyle_hard_blocker: {lifestyle_preassessment.hard_blocker}",
                "",
                "Financial signals:",
                f"- structured_compensation_data: {job_compensation_signal.get('structured')}",
                f"- extracted_compensation_signal: {job_compensation_signal.get('signal')}",
                f"- compensation_comparison_hint: {comparison_hint['summary']}",
                f"- financial_fit_signal: {comparison_hint['financial_fit']}",
            ]
        )

        lines.extend(
            [
                "Output rules:",
                "- fit_classification must be one allowed label.",
                "- fit_rationale must be 1 to 3 short factual sentences.",
                "- Do not use scores, percentages, or rankings.",
                "- decision.headline must be one short line on whether this job is worth spending time on.",
                "- decision.detail must be 2 to 4 short factual sentences.",
                "- decision.risk_flags must contain up to 4 short bullet-style strings.",
                "- decision.clarifying_questions must contain up to 3 short question strings.",
                "- dimension_assessment must always be included when feasible.",
                "- dimension_assessment.key_drivers must contain up to 4 short positive reasons.",
                "- dimension_assessment.key_tradeoffs must contain up to 4 short tensions or compromises.",
                "- dimension_assessment.key_unknowns must contain up to 4 short missing-info items.",
                "- decision_v2 is optional, but include it whenever feasible.",
                "- decision_v2.compensation_assessment.summary must be one short sentence.",
                "- decision_v2.tradeoffs must contain 2 to 5 concise strings when present.",
                "- decision_v2.career_positioning.narrative must be 2 to 4 short sentences.",
                "- decision_v2.confidence reflects confidence in compensation and strategic claims.",
                "- Never invent precise compensation numbers.",
                "- Treat compensation as uncertain unless clearly stated.",
                "- Prefer qualitative comparison over numeric precision.",
                "- Explicitly mention uncertainty when compensation data is missing.",
                "- Use fit_classification as context, but do not duplicate it as the whole decision output.",
                "",
                "Job input:",
                f"- title: {title or ''}",
                f"- company: {company or ''}",
                f"- location: {location or ''}",
                f"- description: {description[:MAX_JOB_DESCRIPTION_CHARS]}",
            ]
        )
        return "\n".join(lines)

    def _build_compensation_comparison_hint(
        self,
        *,
        user_decision_context: dict[str, Any],
        job_compensation_signal: dict[str, Any],
    ) -> dict[str, str]:
        baseline = user_decision_context.get("financial_baseline")
        if not isinstance(baseline, dict):
            return {"summary": "No user baseline available.", "financial_fit": "unknown"}
        basis = baseline.get("basis")
        if basis not in ("annual_salary", "daily_rate", "hourly"):
            return {"summary": "No comparable user baseline available.", "financial_fit": "unknown"}

        baseline_normalized = normalize_compensation(
            amount=float(baseline.get("amount", 0)),
            currency=str(baseline.get("currency", "USD")),
            basis=basis,
            hours_per_week=baseline.get("hours_per_week"),
            days_per_year=baseline.get("days_per_year"),
        )
        job_normalized = job_compensation_signal.get("normalized")
        hint = build_comparison_hint(
            user_baseline=baseline_normalized,
            job_compensation=job_normalized if job_normalized else None,
        )
        return {
            "summary": hint.summary,
            "financial_fit": self._map_compensation_relation_to_financial_fit(hint.relation),
        }

    def _resolve_dimension_assessment(
        self,
        *,
        llm_assessment: JobDimensionAssessment | None,
        fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"],
        comparison_hint: dict[str, str],
        lifestyle_preassessment: LifestylePreassessment,
    ) -> JobDimensionAssessment:
        strategic_fit = (
            llm_assessment.strategic_fit
            if llm_assessment is not None
            else self._fallback_strategic_fit(fit_classification)
        )
        financial_fit = (
            llm_assessment.financial_fit
            if llm_assessment is not None
            else comparison_hint["financial_fit"]
        )
        lifestyle_fit = (
            llm_assessment.lifestyle_fit
            if llm_assessment is not None
            else lifestyle_preassessment.lifestyle_fit
        )

        if lifestyle_preassessment.hard_blocker:
            lifestyle_fit = lifestyle_preassessment.lifestyle_fit
        elif lifestyle_fit == "unknown" and lifestyle_preassessment.lifestyle_fit != "unknown":
            lifestyle_fit = lifestyle_preassessment.lifestyle_fit

        key_drivers = self._sanitize_short_list(
            llm_assessment.key_drivers if llm_assessment is not None else [],
            max_items=4,
        )
        key_tradeoffs = self._sanitize_short_list(
            llm_assessment.key_tradeoffs if llm_assessment is not None else [],
            max_items=4,
        )
        key_unknowns = self._sanitize_short_list(
            llm_assessment.key_unknowns if llm_assessment is not None else [],
            max_items=4,
        )

        if lifestyle_preassessment.rationale:
            if lifestyle_fit in {"incompatible", "constrained"}:
                key_tradeoffs = self._prepend_unique(key_tradeoffs, lifestyle_preassessment.rationale, max_items=4)
            elif lifestyle_fit == "unknown":
                key_unknowns = self._prepend_unique(key_unknowns, lifestyle_preassessment.rationale, max_items=4)

        return JobDimensionAssessment(
            strategic_fit=strategic_fit,
            financial_fit=financial_fit,
            lifestyle_fit=lifestyle_fit,
            key_drivers=key_drivers,
            key_tradeoffs=key_tradeoffs,
            key_unknowns=key_unknowns,
        )

    def _fallback_strategic_fit(
        self,
        fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"],
    ) -> Literal["high", "medium", "low"]:
        if fit_classification == "strong_fit":
            return "high"
        if fit_classification == "misaligned":
            return "low"
        return "medium"

    def _map_compensation_relation_to_financial_fit(
        self,
        relation: Literal["below", "in_line", "above", "unknown"],
    ) -> Literal["upgrade", "neutral", "downgrade", "unknown"]:
        if relation == "above":
            return "upgrade"
        if relation == "below":
            return "downgrade"
        if relation == "in_line":
            return "neutral"
        return "unknown"

    def _sanitize_short_list(self, items: list[str], *, max_items: int) -> list[str]:
        return [item.strip() for item in items if item.strip()][:max_items]

    def _prepend_unique(self, items: list[str], value: str, *, max_items: int) -> list[str]:
        cleaned = value.strip()
        if not cleaned:
            return items[:max_items]
        normalized_cleaned = cleaned.lower()
        filtered = [item for item in items if item.strip().lower() != normalized_cleaned]
        return [cleaned, *filtered][:max_items]

    def _extract_job_compensation_signal(self, description: str) -> dict[str, Any]:
        compensation_display = extract_compensation_display(description)
        annual_match = re.search(r"\$\s*([\d,]{2,})\s*(?:-|to)\s*\$?\s*([\d,]{2,})", description, re.I)
        single_annual_match = re.search(r"\$\s*([\d,]{2,})\s*(?:per year|/year|annually|annual)", description, re.I)
        hourly_match = re.search(r"\$\s*([\d,]{1,3}(?:\.\d{1,2})?)\s*(?:/hour|per hour|hourly)", description, re.I)
        daily_match = re.search(r"\$\s*([\d,]{2,4}(?:\.\d{1,2})?)\s*(?:/day|per day|daily rate)", description, re.I)

        if annual_match:
            low = float(annual_match.group(1).replace(",", ""))
            high = float(annual_match.group(2).replace(",", ""))
            midpoint = (low + high) / 2
            return {
                "structured": "none",
                "signal": (
                    f"Compensation range appears to be about {compensation_display}."
                    if compensation_display
                    else f"Compensation range appears to be about ${int(low):,} to ${int(high):,} annually."
                ),
                "normalized": normalize_compensation(amount=midpoint, currency="USD", basis="annual_salary"),
            }
        if single_annual_match:
            amount = float(single_annual_match.group(1).replace(",", ""))
            return {
                "structured": "none",
                "signal": (
                    f"Compensation appears to be about {compensation_display}."
                    if compensation_display
                    else f"Compensation appears to be about ${int(amount):,} annually."
                ),
                "normalized": normalize_compensation(amount=amount, currency="USD", basis="annual_salary"),
            }
        if hourly_match:
            amount = float(hourly_match.group(1).replace(",", ""))
            return {
                "structured": "none",
                "signal": (
                    f"Compensation appears to be about {compensation_display}."
                    if compensation_display
                    else f"Compensation appears to be about ${amount:.2f} hourly."
                ),
                "normalized": normalize_compensation(amount=amount, currency="USD", basis="hourly"),
            }
        if daily_match:
            amount = float(daily_match.group(1).replace(",", ""))
            return {
                "structured": "none",
                "signal": (
                    f"Compensation appears to be about {compensation_display}."
                    if compensation_display
                    else f"Compensation appears to be about ${amount:.2f} daily."
                ),
                "normalized": normalize_compensation(amount=amount, currency="USD", basis="daily_rate"),
            }
        return {
            "structured": "none",
            "signal": "Compensation is not clearly specified.",
            "normalized": None,
        }


@lru_cache
def get_job_fit_assessment_service() -> JobFitAssessmentService:
    return JobFitAssessmentService()
