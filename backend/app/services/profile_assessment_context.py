import hashlib
import json
from typing import Any

from app.services.profile_rules import (
    MAX_DECISION_DIMENSIONS,
    MAX_INTERPRETATION_RULES,
    MAX_NON_NEGOTIABLES,
    MAX_SIGNALS_PER_BUCKET,
    sanitize_classification_labels,
    sanitize_location_preferences,
    sanitize_string_list,
)
from app.services.compensation_normalization import normalize_compensation


def build_profile_assessment_context(profile: dict[str, Any]) -> dict[str, Any] | None:
    fit_model = profile.get("job_fit_model")
    preferences = profile.get("analysis_preferences_for_job_assistant")
    if not isinstance(fit_model, dict) or not isinstance(preferences, dict):
        return None

    labels = sanitize_classification_labels(preferences.get("classification_labels"))
    if not labels:
        return None

    interpretation_subset = sanitize_string_list(
        preferences.get("interpretation_rules"),
        max_items=MAX_INTERPRETATION_RULES,
    )

    strong_fit_signals = sanitize_string_list(
        fit_model.get("strong_fit_signals"),
        max_items=MAX_SIGNALS_PER_BUCKET,
    )
    acceptable_signals = sanitize_string_list(
        fit_model.get("acceptable_but_intermediate_signals"),
        max_items=MAX_SIGNALS_PER_BUCKET,
    )
    misaligned_signals = sanitize_string_list(
        fit_model.get("misaligned_signals"),
        max_items=MAX_SIGNALS_PER_BUCKET,
    )
    if not strong_fit_signals or not acceptable_signals or not misaligned_signals:
        return None

    decision_dimensions = sanitize_string_list(
        preferences.get("decision_dimensions") or fit_model.get("decision_dimensions"),
        max_items=MAX_DECISION_DIMENSIONS,
    )

    return {
        "labels": labels,
        "strong_fit_signals": strong_fit_signals,
        "acceptable_signals": acceptable_signals,
        "misaligned_signals": misaligned_signals,
        "interpretation_rules": interpretation_subset,
        "decision_dimensions": decision_dimensions,
        "user_decision_context": build_user_decision_context(profile),
    }


def build_user_decision_context(profile: dict[str, Any]) -> dict[str, Any]:
    summary = profile.get("profile_summary")
    profile_summary = summary.strip() if isinstance(summary, str) and summary.strip() else None
    return {
        "profile_summary": profile_summary,
        "financial_baseline": _sanitize_financial_baseline(
            profile.get("financial_baseline_for_job_assistant")
        ),
        "strategic_preferences": _sanitize_strategic_preferences(
            profile.get("strategic_preferences_for_job_assistant")
        ),
        "location_preferences": sanitize_location_preferences(
            profile.get("location_preferences_for_job_assistant")
        ),
    }


def build_profile_context_fingerprint(profile_context: dict[str, Any]) -> str:
    cache_payload = {
        "labels": profile_context.get("labels"),
        "signals": {
            "strong": profile_context.get("strong_fit_signals"),
            "acceptable": profile_context.get("acceptable_signals"),
            "misaligned": profile_context.get("misaligned_signals"),
        },
        "interpretation_rules": profile_context.get("interpretation_rules"),
        "decision_dimensions": profile_context.get("decision_dimensions"),
        "user_decision_context": profile_context.get("user_decision_context"),
    }
    encoded = json.dumps(cache_payload, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()[:16]


def _sanitize_financial_baseline(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    amount = value.get("amount")
    currency = value.get("currency")
    basis = value.get("basis")
    if not isinstance(amount, (float, int)) or amount <= 0:
        return None
    if not isinstance(currency, str) or not currency.strip():
        return None
    if basis not in ("annual_salary", "daily_rate", "hourly"):
        return None

    hours_per_week = value.get("hours_per_week")
    days_per_year = value.get("days_per_year")
    hours = float(hours_per_week) if isinstance(hours_per_week, (float, int)) else None
    days = float(days_per_year) if isinstance(days_per_year, (float, int)) else None

    normalized = normalize_compensation(
        amount=float(amount),
        currency=currency.strip().upper(),
        basis=basis,
        hours_per_week=hours,
        days_per_year=days,
    )
    if normalized is None:
        return None

    return {
        "amount": normalized.amount,
        "currency": normalized.currency,
        "basis": normalized.basis,
        "hours_per_week": normalized.hours_per_week,
        "days_per_year": normalized.days_per_year,
        "normalized": {
            "annual_amount": normalized.annual_amount,
            "daily_amount": normalized.daily_amount,
            "hourly_amount": normalized.hourly_amount,
        },
    }


def _sanitize_strategic_preferences(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    risk_tolerance = (
        value.get("risk_tolerance") if value.get("risk_tolerance") in ("low", "medium", "high") else None
    )
    time_horizon = value.get("time_horizon") if value.get("time_horizon") in ("short", "mid", "long") else None
    career_stage = value.get("career_stage")
    normalized_stage = career_stage.strip()[:80] if isinstance(career_stage, str) and career_stage.strip() else None
    non_negotiables = sanitize_string_list(
        value.get("non_negotiables"),
        max_items=MAX_NON_NEGOTIABLES,
    )

    if not (risk_tolerance or time_horizon or normalized_stage or non_negotiables):
        return None
    return {
        "risk_tolerance": risk_tolerance,
        "time_horizon": time_horizon,
        "career_stage": normalized_stage,
        "non_negotiables": non_negotiables,
    }
