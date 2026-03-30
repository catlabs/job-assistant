from __future__ import annotations

import json
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from openai import APIConnectionError, APIError, APITimeoutError, OpenAI

from app.core.config import get_settings
from app.core.security import require_api_key
from app.schemas.profile import ProfileExplainResponse, ProfileResponse, ProfileUpdateRequest
from app.services.llm_call_logging import _extract_usage_tokens, log_llm_call
from app.services.llm_operations import LlmOperation
from app.services.profile_assessment_context import build_profile_assessment_context
from app.services.profile_loader import load_user_profile, merge_user_profile, save_user_profile
from app.services.profile_rules import (
    EXPECTED_FIT_LABELS_ORDER,
    MAX_DECISION_DIMENSIONS,
    MAX_INTERPRETATION_RULES,
    MAX_NON_NEGOTIABLES,
    MAX_SIGNALS_PER_BUCKET,
    sanitize_location_preferences,
    sanitize_string_list,
)

router = APIRouter(prefix="/profile", tags=["profile"])
# V1 storage is a single local profile file; future multi-profile can keep this response shape
# and swap storage behind these handlers.


def _extract_explanation(profile: dict[str, Any]) -> str | None:
    explanation = profile.get("explanation")
    if not isinstance(explanation, str):
        return None
    text = explanation.strip()
    return text or None


def _build_profile_response(profile: dict[str, Any]) -> ProfileResponse:
    fit_model = profile.get("job_fit_model") if isinstance(profile.get("job_fit_model"), dict) else {}
    preferences = (
        profile.get("analysis_preferences_for_job_assistant")
        if isinstance(profile.get("analysis_preferences_for_job_assistant"), dict)
        else {}
    )
    summary = profile.get("profile_summary")
    financial_baseline = (
        profile.get("financial_baseline_for_job_assistant")
        if isinstance(profile.get("financial_baseline_for_job_assistant"), dict)
        else None
    )
    strategic_preferences = (
        profile.get("strategic_preferences_for_job_assistant")
        if isinstance(profile.get("strategic_preferences_for_job_assistant"), dict)
        else None
    )
    location_preferences = sanitize_location_preferences(
        profile.get("location_preferences_for_job_assistant")
    )

    return ProfileResponse(
        profile_summary=summary.strip() if isinstance(summary, str) and summary.strip() else None,
        job_fit_model={
            "strong_fit_signals": sanitize_string_list(
                fit_model.get("strong_fit_signals"),
                max_items=MAX_SIGNALS_PER_BUCKET,
            ),
            "acceptable_but_intermediate_signals": sanitize_string_list(
                fit_model.get("acceptable_but_intermediate_signals"),
                max_items=MAX_SIGNALS_PER_BUCKET,
            ),
            "misaligned_signals": sanitize_string_list(
                fit_model.get("misaligned_signals"),
                max_items=MAX_SIGNALS_PER_BUCKET,
            ),
        },
        analysis_preferences_for_job_assistant={
            "classification_labels": list(EXPECTED_FIT_LABELS_ORDER),
            "interpretation_rules": sanitize_string_list(
                preferences.get("interpretation_rules"),
                max_items=MAX_INTERPRETATION_RULES,
            ),
            "decision_dimensions": sanitize_string_list(
                preferences.get("decision_dimensions"),
                max_items=MAX_DECISION_DIMENSIONS,
            ),
        },
        financial_baseline_for_job_assistant=(
            {
                "amount": financial_baseline.get("amount"),
                "currency": financial_baseline.get("currency"),
                "basis": financial_baseline.get("basis"),
                "hours_per_week": financial_baseline.get("hours_per_week"),
                "days_per_year": financial_baseline.get("days_per_year"),
            }
            if financial_baseline
            and isinstance(financial_baseline.get("amount"), (float, int))
            and isinstance(financial_baseline.get("currency"), str)
            and isinstance(financial_baseline.get("basis"), str)
            else None
        ),
        strategic_preferences_for_job_assistant=(
            {
                "risk_tolerance": strategic_preferences.get("risk_tolerance"),
                "time_horizon": strategic_preferences.get("time_horizon"),
                "career_stage": strategic_preferences.get("career_stage"),
                "non_negotiables": sanitize_string_list(
                    strategic_preferences.get("non_negotiables"),
                    max_items=MAX_NON_NEGOTIABLES,
                ),
            }
            if strategic_preferences
            else None
        ),
        location_preferences_for_job_assistant=location_preferences,
        fit_analysis_enabled=build_profile_assessment_context(profile) is not None,
        explanation=_extract_explanation(profile),
    )


def _build_profile_explain_prompt(profile: dict[str, Any]) -> str:
    context = build_profile_assessment_context(profile)
    if context is None:
        return ""

    profile_summary = profile.get("profile_summary")
    summary_line = profile_summary.strip() if isinstance(profile_summary, str) else ""

    lines = [
        "Explain in plain, non-technical language how this profile affects job fit and decision analysis.",
        "Keep it short (4-6 sentences).",
        "Mention what tends to be treated as strong fit, acceptable intermediate, and misaligned.",
        "If interpretation rules or decision dimensions exist, mention them briefly.",
        "Do not include bullet points.",
        "",
        f"Profile summary: {summary_line or '(none)'}",
        f"Strong fit signals: {context['strong_fit_signals']}",
        f"Acceptable intermediate signals: {context['acceptable_signals']}",
        f"Misaligned signals: {context['misaligned_signals']}",
        f"Interpretation rules: {context['interpretation_rules']}",
        f"Decision dimensions: {context['decision_dimensions']}",
    ]
    return "\n".join(lines)


def _generate_profile_explanation(
    profile: dict[str, Any],
    *,
    fail_on_error: bool,
) -> ProfileExplainResponse:
    settings = get_settings()
    api_key = settings.openai_api_key.get_secret_value() if settings.openai_api_key else ""
    if not api_key:
        return ProfileExplainResponse(
            enabled=False,
            message="Profile explanation unavailable because OpenAI is not configured.",
        )

    prompt = _build_profile_explain_prompt(profile)
    if not prompt:
        return ProfileExplainResponse(
            enabled=False,
            message="Profile explanation is unavailable until fit analysis is enabled.",
        )

    client = OpenAI(
        api_key=api_key,
        timeout=settings.openai_timeout_seconds,
        http_client=httpx.Client(timeout=settings.openai_timeout_seconds),
    )
    metadata = json.dumps({"fit_analysis_enabled": True})

    try:
        completion = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": "You explain profile impact on job fit analysis in concise user-facing text.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        explanation = completion.choices[0].message.content if completion.choices else ""
        text = explanation.strip() if isinstance(explanation, str) else ""
        if not text:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="LLM returned an empty explanation.",
            )

        prompt_tokens, completion_tokens, total_tokens = _extract_usage_tokens(completion.usage)
        log_llm_call(
            operation=LlmOperation.PROFILE_EXPLAIN,
            status="success",
            model=completion.model or settings.openai_model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            extra_json=metadata,
        )
        return ProfileExplainResponse(
            enabled=True,
            message="Profile explanation generated.",
            explanation=text,
        )
    except HTTPException:
        log_llm_call(
            operation=LlmOperation.PROFILE_EXPLAIN,
            status="error",
            model=settings.openai_model,
            error_message="Empty explanation content.",
            extra_json=metadata,
        )
        if fail_on_error:
            raise
        return ProfileExplainResponse(
            enabled=False,
            message="Could not generate profile explanation.",
        )
    except (APITimeoutError, APIConnectionError, APIError) as exc:
        log_llm_call(
            operation=LlmOperation.PROFILE_EXPLAIN,
            status="error",
            model=settings.openai_model,
            error_message=str(exc),
            extra_json=metadata,
        )
        if fail_on_error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not generate profile explanation.",
            ) from exc
        return ProfileExplainResponse(
            enabled=False,
            message="Could not generate profile explanation.",
        )


@router.get("/", response_model=ProfileResponse)
def get_profile() -> ProfileResponse:
    profile = load_user_profile()
    return _build_profile_response(profile)


@router.put("/", response_model=ProfileResponse, dependencies=[Depends(require_api_key)])
def update_profile(payload: ProfileUpdateRequest) -> ProfileResponse:
    existing = load_user_profile()
    merged_profile = merge_user_profile(existing, payload.model_dump(exclude_unset=True))

    if build_profile_assessment_context(merged_profile) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Saved profile must remain usable for fit analysis.",
        )

    save_user_profile(merged_profile)
    explain_result = _generate_profile_explanation(merged_profile, fail_on_error=False)
    if explain_result.explanation:
        merged_profile["explanation"] = explain_result.explanation
        save_user_profile(merged_profile)
    return _build_profile_response(merged_profile)


@router.post("/explain", response_model=ProfileExplainResponse, dependencies=[Depends(require_api_key)])
def explain_profile() -> ProfileExplainResponse:
    profile = load_user_profile()
    result = _generate_profile_explanation(profile, fail_on_error=True)
    if result.explanation:
        profile["explanation"] = result.explanation
        save_user_profile(profile)
    return result
