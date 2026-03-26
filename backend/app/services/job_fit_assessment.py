from functools import lru_cache
from typing import Any, Literal

import httpx
from openai import APIConnectionError, APIError, APITimeoutError, OpenAI
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings
from app.services.profile_loader import load_user_profile
from app.services.profile_assessment_context import build_profile_assessment_context
from app.schemas.job import JobDecisionV1

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


class JobFitAssessmentResult(BaseModel):
    fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"] | None = None
    fit_rationale: str = ""
    decision: JobDecisionV1 | None = None


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
    ) -> JobFitAssessmentResult:
        settings = get_settings()
        api_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key else ""
        if not api_key:
            return JobFitAssessmentResult()

        profile_context = build_profile_assessment_context(load_user_profile())
        if profile_context is None:
            return JobFitAssessmentResult()

        if self._client is None:
            # openai==1.51.x is not compatible with httpx 0.28's removed "proxies" arg
            # when using its default internal client wrapper.
            http_client = httpx.Client(timeout=settings.openai_timeout_seconds)
            self._client = OpenAI(
                api_key=api_key,
                timeout=settings.openai_timeout_seconds,
                http_client=http_client,
            )

        prompt = self._build_prompt(
            profile_context=profile_context,
            title=title,
            company=company,
            location=location,
            description=description,
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
                return JobFitAssessmentResult()
            result = CombinedAssessmentResponse.model_validate(parsed)
        except (APITimeoutError, APIConnectionError, APIError, ValidationError):
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
        )

    def _build_prompt(
        self,
        *,
        profile_context: dict[str, Any],
        title: str | None,
        company: str | None,
        location: str | None,
        description: str,
    ) -> str:
        lines = [
            "Classify this job and provide concise decision support using only the provided profile vocabulary.",
            f"Allowed labels: {', '.join(profile_context['labels'])}",
            "Job fit model signals:",
            f"- strong_fit_signals: {profile_context['strong_fit_signals']}",
            f"- acceptable_but_intermediate_signals: {profile_context['acceptable_signals']}",
            f"- misaligned_signals: {profile_context['misaligned_signals']}",
        ]
        if profile_context["interpretation_rules"]:
            lines.append(
                f"Interpretation guidance: {profile_context['interpretation_rules']}"
            )
        if profile_context["decision_dimensions"]:
            lines.append(
                f"Decision dimensions to consider when relevant: {profile_context['decision_dimensions']}"
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


@lru_cache
def get_job_fit_assessment_service() -> JobFitAssessmentService:
    return JobFitAssessmentService()
