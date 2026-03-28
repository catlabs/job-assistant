import json
import tempfile
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


def get_profile_summary(profile: dict[str, Any]) -> str | None:
    summary = profile.get("profile_summary")
    return summary if isinstance(summary, str) and summary.strip() else None
