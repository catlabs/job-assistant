from typing import Any

from app.services.profile_rules import (
    MAX_DECISION_DIMENSIONS,
    MAX_INTERPRETATION_RULES,
    MAX_SIGNALS_PER_BUCKET,
    sanitize_classification_labels,
    sanitize_string_list,
)


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
    }
