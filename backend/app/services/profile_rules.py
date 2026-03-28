from __future__ import annotations

from typing import Any

EXPECTED_FIT_LABELS_ORDER = ("strong_fit", "acceptable_intermediate", "misaligned")
VALID_FIT_LABELS = set(EXPECTED_FIT_LABELS_ORDER)
MAX_INTERPRETATION_RULES = 3
MAX_SIGNALS_PER_BUCKET = 5
MAX_DECISION_DIMENSIONS = 3


def sanitize_string_list(value: Any, *, max_items: int) -> list[str]:
    if not isinstance(value, list):
        return []
    sanitized = [item.strip() for item in value if isinstance(item, str) and item.strip()]
    return sanitized[:max_items]


def sanitize_classification_labels(value: Any) -> list[str]:
    labels = sanitize_string_list(value, max_items=len(EXPECTED_FIT_LABELS_ORDER))
    if set(labels) != VALID_FIT_LABELS:
        return []
    return list(EXPECTED_FIT_LABELS_ORDER)


def validate_string_list(
    value: Any,
    *,
    field_name: str,
    max_items: int,
    require_non_empty: bool = False,
) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f"{field_name} must be a list of strings.")

    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ValueError(f"{field_name} must contain only strings.")
        stripped = item.strip()
        if stripped:
            normalized.append(stripped)

    if require_non_empty and not normalized:
        raise ValueError(f"{field_name} must contain at least one non-empty value.")

    if len(normalized) > max_items:
        raise ValueError(f"{field_name} supports at most {max_items} entries.")

    return normalized


def validate_classification_labels(value: Any) -> list[str]:
    labels = validate_string_list(
        value,
        field_name="classification_labels",
        max_items=len(EXPECTED_FIT_LABELS_ORDER),
        require_non_empty=True,
    )
    if set(labels) != VALID_FIT_LABELS or len(labels) != len(EXPECTED_FIT_LABELS_ORDER):
        expected = ", ".join(EXPECTED_FIT_LABELS_ORDER)
        raise ValueError(f"classification_labels must be exactly: {expected}.")
    return list(EXPECTED_FIT_LABELS_ORDER)
