import json
import tempfile
from pathlib import Path
from typing import Any


DEFAULT_PROFILE_PATH = Path(__file__).resolve().parents[3] / "user_profile.json"
PROFILE_SECTION_FIELDS: dict[str, tuple[str, ...]] = {
    "job_fit_model": (
        "strong_fit_signals",
        "acceptable_but_intermediate_signals",
        "misaligned_signals",
    ),
    "analysis_preferences_for_job_assistant": (
        "classification_labels",
        "interpretation_rules",
        "decision_dimensions",
    ),
    "financial_baseline_for_job_assistant": (
        "amount",
        "currency",
        "basis",
        "hours_per_week",
        "days_per_year",
    ),
    "strategic_preferences_for_job_assistant": (
        "risk_tolerance",
        "time_horizon",
        "career_stage",
        "non_negotiables",
    ),
}
LOCATION_PREFERENCE_SECTION_FIELDS: dict[str, tuple[str, ...]] = {
    "brussels": (
        "max_onsite_days_per_week",
        "notes",
    ),
    "nearby_cities": (
        "max_onsite_days_per_period",
        "period_weeks",
        "notes",
    ),
    "far_locations": (
        "remote_required",
        "max_travel_days_per_month",
        "notes",
    ),
}


def load_user_profile(path: Path | None = None) -> dict[str, Any]:
    profile_path = path or DEFAULT_PROFILE_PATH
    if not profile_path.exists():
        return {}

    try:
        raw = json.loads(profile_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    return raw if isinstance(raw, dict) else {}


def save_user_profile(profile: dict[str, Any], path: Path | None = None) -> None:
    profile_path = path or DEFAULT_PROFILE_PATH
    profile_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=profile_path.parent,
        prefix=f"{profile_path.name}.",
        suffix=".tmp",
        delete=False,
    ) as temp_file:
        json.dump(profile, temp_file, indent=2, ensure_ascii=True)
        temp_file.write("\n")
        temp_name = temp_file.name

    Path(temp_name).replace(profile_path)


def merge_user_profile(existing: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    merged = dict(existing) if isinstance(existing, dict) else {}

    if "profile_summary" in updates:
        _assign_or_remove(merged, "profile_summary", updates.get("profile_summary"))

    for section, fields in PROFILE_SECTION_FIELDS.items():
        if section not in updates:
            continue

        value = updates.get(section)
        if value is None:
            merged.pop(section, None)
            continue

        merged[section] = _merge_known_fields(merged.get(section), value, fields)

    if "location_preferences_for_job_assistant" in updates:
        value = updates.get("location_preferences_for_job_assistant")
        if value is None:
            merged.pop("location_preferences_for_job_assistant", None)
        else:
            merged_section = _merge_location_preferences_section(
                merged.get("location_preferences_for_job_assistant"),
                value,
            )
            if merged_section:
                merged["location_preferences_for_job_assistant"] = merged_section
            else:
                merged.pop("location_preferences_for_job_assistant", None)

    return merged


def get_profile_summary(profile: dict[str, Any]) -> str | None:
    summary = profile.get("profile_summary")
    return summary if isinstance(summary, str) and summary.strip() else None


def _assign_or_remove(target: dict[str, Any], key: str, value: Any) -> None:
    if value is None:
        target.pop(key, None)
    else:
        target[key] = value


def _merge_known_fields(
    existing_value: Any,
    incoming_value: Any,
    fields: tuple[str, ...],
) -> dict[str, Any]:
    merged = dict(existing_value) if isinstance(existing_value, dict) else {}
    if not isinstance(incoming_value, dict):
        return merged

    for field in fields:
        if field not in incoming_value:
            continue
        _assign_or_remove(merged, field, incoming_value.get(field))
    return merged


def _merge_location_preferences_section(existing_value: Any, incoming_value: Any) -> dict[str, Any]:
    merged = dict(existing_value) if isinstance(existing_value, dict) else {}
    if not isinstance(incoming_value, dict):
        return merged

    for section, fields in LOCATION_PREFERENCE_SECTION_FIELDS.items():
        if section not in incoming_value:
            continue

        section_value = incoming_value.get(section)
        if section_value is None:
            merged.pop(section, None)
            continue

        merged_section = _merge_known_fields(merged.get(section), section_value, fields)
        if merged_section:
            merged[section] = merged_section
        else:
            merged.pop(section, None)

    return merged
