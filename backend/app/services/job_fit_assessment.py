from functools import lru_cache
from typing import Any, Literal

import httpx
from openai import APIConnectionError, APIError, APITimeoutError, OpenAI
from pydantic import BaseModel, ValidationError

from app.core.config import get_settings
from app.services.profile_loader import load_user_profile

MAX_JOB_DESCRIPTION_CHARS = 6_000
MAX_INTERPRETATION_RULES = 3
MAX_SIGNALS_PER_BUCKET = 4


class FitAssessmentResponse(BaseModel):
    fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"]
    fit_rationale: str


class JobFitAssessmentResult(BaseModel):
    fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"] | None = None
    fit_rationale: str = ""


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

        profile_context = self._build_profile_context(load_user_profile())
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
                            "You classify job fit for a specific profile. "
                            "Return only valid JSON matching the response schema."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format=FitAssessmentResponse,
                temperature=0,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                return JobFitAssessmentResult()
            result = FitAssessmentResponse.model_validate(parsed)
        except (APITimeoutError, APIConnectionError, APIError, ValidationError):
            return JobFitAssessmentResult()

        return JobFitAssessmentResult(
            fit_classification=result.fit_classification,
            fit_rationale=result.fit_rationale.strip(),
        )

    def _build_profile_context(self, profile: dict[str, Any]) -> dict[str, Any] | None:
        fit_model = profile.get("job_fit_model")
        preferences = profile.get("analysis_preferences_for_job_assistant")
        if not isinstance(fit_model, dict) or not isinstance(preferences, dict):
            return None

        labels = preferences.get("classification_labels")
        if not isinstance(labels, list) or not labels:
            return None

        valid_labels = {"strong_fit", "acceptable_intermediate", "misaligned"}
        normalized_labels = [label for label in labels if isinstance(label, str)]
        if set(normalized_labels) != valid_labels:
            return None

        interpretation_rules = preferences.get("interpretation_rules")
        interpretation_subset = []
        if isinstance(interpretation_rules, list):
            interpretation_subset = [
                rule for rule in interpretation_rules if isinstance(rule, str) and rule.strip()
            ][:MAX_INTERPRETATION_RULES]

        strong_fit_signals = self._extract_signal_subset(fit_model.get("strong_fit_signals"))
        acceptable_signals = self._extract_signal_subset(
            fit_model.get("acceptable_but_intermediate_signals")
        )
        misaligned_signals = self._extract_signal_subset(fit_model.get("misaligned_signals"))
        if not strong_fit_signals or not acceptable_signals or not misaligned_signals:
            return None

        return {
            "labels": normalized_labels,
            "strong_fit_signals": strong_fit_signals,
            "acceptable_signals": acceptable_signals,
            "misaligned_signals": misaligned_signals,
            "interpretation_rules": interpretation_subset,
        }

    def _extract_signal_subset(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, str) and item.strip()][
            :MAX_SIGNALS_PER_BUCKET
        ]

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
            "Classify this job using only the provided profile vocabulary.",
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

        lines.extend(
            [
                "Output rules:",
                "- fit_classification must be one allowed label.",
                "- fit_rationale must be 1 to 3 short factual sentences.",
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
