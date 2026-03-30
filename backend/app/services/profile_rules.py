from __future__ import annotations

import math
from typing import Any

EXPECTED_FIT_LABELS_ORDER = ("strong_fit", "acceptable_intermediate", "misaligned")
VALID_FIT_LABELS = set(EXPECTED_FIT_LABELS_ORDER)
MAX_INTERPRETATION_RULES = 3
MAX_SIGNALS_PER_BUCKET = 5
MAX_DECISION_DIMENSIONS = 3
MAX_NON_NEGOTIABLES = 5
MAX_LOCATION_PREFERENCE_NOTE_LENGTH = 160
MAX_BRUSSELS_ONSITE_DAYS_PER_WEEK = 7
MAX_NEARBY_CITIES_ONSITE_DAYS_PER_PERIOD = 14
MAX_NEARBY_CITIES_PERIOD_WEEKS = 8
MAX_FAR_LOCATIONS_TRAVEL_DAYS_PER_MONTH = 31


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


def sanitize_optional_string(value: Any, *, max_length: int) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped:
        return None
    return stripped[:max_length]


def validate_optional_string(
    value: Any,
    *,
    field_name: str,
    max_length: int,
) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string.")

    stripped = value.strip()
    if not stripped:
        return None
    if len(stripped) > max_length:
        raise ValueError(f"{field_name} supports at most {max_length} characters.")
    return stripped


def sanitize_optional_int(
    value: Any,
    *,
    min_value: int,
    max_value: int,
) -> int | None:
    if isinstance(value, bool):
        return None

    normalized: int | None
    if isinstance(value, int):
        normalized = value
    elif isinstance(value, float) and math.isfinite(value) and value.is_integer():
        normalized = int(value)
    else:
        return None

    if normalized < min_value or normalized > max_value:
        return None
    return normalized


def sanitize_location_preferences(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    brussels = _sanitize_brussels_location_preferences(value.get("brussels"))
    nearby_cities = _sanitize_nearby_cities_location_preferences(value.get("nearby_cities"))
    far_locations = _sanitize_far_locations_location_preferences(value.get("far_locations"))

    if not (brussels or nearby_cities or far_locations):
        return None

    result: dict[str, Any] = {}
    if brussels:
        result["brussels"] = brussels
    if nearby_cities:
        result["nearby_cities"] = nearby_cities
    if far_locations:
        result["far_locations"] = far_locations
    return result


def _sanitize_brussels_location_preferences(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    max_onsite_days_per_week = sanitize_optional_int(
        value.get("max_onsite_days_per_week"),
        min_value=0,
        max_value=MAX_BRUSSELS_ONSITE_DAYS_PER_WEEK,
    )
    notes = sanitize_optional_string(
        value.get("notes"),
        max_length=MAX_LOCATION_PREFERENCE_NOTE_LENGTH,
    )

    if max_onsite_days_per_week is None and notes is None:
        return None

    result: dict[str, Any] = {}
    if max_onsite_days_per_week is not None:
        result["max_onsite_days_per_week"] = max_onsite_days_per_week
    if notes is not None:
        result["notes"] = notes
    return result


def _sanitize_nearby_cities_location_preferences(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    max_onsite_days_per_period = sanitize_optional_int(
        value.get("max_onsite_days_per_period"),
        min_value=0,
        max_value=MAX_NEARBY_CITIES_ONSITE_DAYS_PER_PERIOD,
    )
    period_weeks = sanitize_optional_int(
        value.get("period_weeks"),
        min_value=1,
        max_value=MAX_NEARBY_CITIES_PERIOD_WEEKS,
    )
    notes = sanitize_optional_string(
        value.get("notes"),
        max_length=MAX_LOCATION_PREFERENCE_NOTE_LENGTH,
    )

    if max_onsite_days_per_period is None and period_weeks is None and notes is None:
        return None

    result: dict[str, Any] = {}
    if max_onsite_days_per_period is not None:
        result["max_onsite_days_per_period"] = max_onsite_days_per_period
    if period_weeks is not None:
        result["period_weeks"] = period_weeks
    if notes is not None:
        result["notes"] = notes
    return result


def _sanitize_far_locations_location_preferences(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    remote_required = value.get("remote_required") if isinstance(value.get("remote_required"), bool) else None
    max_travel_days_per_month = sanitize_optional_int(
        value.get("max_travel_days_per_month"),
        min_value=0,
        max_value=MAX_FAR_LOCATIONS_TRAVEL_DAYS_PER_MONTH,
    )
    notes = sanitize_optional_string(
        value.get("notes"),
        max_length=MAX_LOCATION_PREFERENCE_NOTE_LENGTH,
    )

    if remote_required is None and max_travel_days_per_month is None and notes is None:
        return None

    result: dict[str, Any] = {}
    if remote_required is not None:
        result["remote_required"] = remote_required
    if max_travel_days_per_month is not None:
        result["max_travel_days_per_month"] = max_travel_days_per_month
    if notes is not None:
        result["notes"] = notes
    return result
