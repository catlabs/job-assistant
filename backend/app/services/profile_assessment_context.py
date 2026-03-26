from typing import Any

MAX_INTERPRETATION_RULES = 3
MAX_SIGNALS_PER_BUCKET = 4
VALID_FIT_LABELS = {"strong_fit", "acceptable_intermediate", "misaligned"}


def build_profile_assessment_context(profile: dict[str, Any]) -> dict[str, Any] | None:
    fit_model = profile.get("job_fit_model")
    preferences = profile.get("analysis_preferences_for_job_assistant")
    if not isinstance(fit_model, dict) or not isinstance(preferences, dict):
        return None

    labels = preferences.get("classification_labels")
    if not isinstance(labels, list) or not labels:
        return None

    normalized_labels = [label for label in labels if isinstance(label, str)]
    if set(normalized_labels) != VALID_FIT_LABELS:
        return None

    interpretation_rules = preferences.get("interpretation_rules")
    interpretation_subset = []
    if isinstance(interpretation_rules, list):
        interpretation_subset = [
            rule for rule in interpretation_rules if isinstance(rule, str) and rule.strip()
        ][:MAX_INTERPRETATION_RULES]

    strong_fit_signals = _extract_signal_subset(fit_model.get("strong_fit_signals"))
    acceptable_signals = _extract_signal_subset(
        fit_model.get("acceptable_but_intermediate_signals")
    )
    misaligned_signals = _extract_signal_subset(fit_model.get("misaligned_signals"))
    if not strong_fit_signals or not acceptable_signals or not misaligned_signals:
        return None

    decision_dimensions = _extract_signal_subset(
        preferences.get("decision_dimensions") or fit_model.get("decision_dimensions"),
        max_items=3,
    )

    return {
        "labels": normalized_labels,
        "strong_fit_signals": strong_fit_signals,
        "acceptable_signals": acceptable_signals,
        "misaligned_signals": misaligned_signals,
        "interpretation_rules": interpretation_subset,
        "decision_dimensions": decision_dimensions,
    }


def _extract_signal_subset(value: Any, *, max_items: int = MAX_SIGNALS_PER_BUCKET) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item.strip()][:max_items]
