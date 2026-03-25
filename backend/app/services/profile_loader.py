import json
from pathlib import Path
from typing import Any


DEFAULT_PROFILE_PATH = Path(__file__).resolve().parents[3] / "user_profile.json"


def load_user_profile(path: Path | None = None) -> dict[str, Any]:
    profile_path = path or DEFAULT_PROFILE_PATH
    if not profile_path.exists():
        return {}

    try:
        raw = json.loads(profile_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    return raw if isinstance(raw, dict) else {}


def get_profile_summary(profile: dict[str, Any]) -> str | None:
    summary = profile.get("profile_summary")
    return summary if isinstance(summary, str) and summary.strip() else None
