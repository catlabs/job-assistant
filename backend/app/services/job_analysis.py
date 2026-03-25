import re
from collections.abc import Iterable


SENIORITY_HINTS = {
    "principal": "principal",
    "staff": "staff",
    "lead": "lead",
    "senior": "senior",
    "mid": "mid",
    "junior": "junior",
}

KEYWORD_HINTS = (
    "python",
    "fastapi",
    "llm",
    "ai",
    "openai",
    "rag",
    "sql",
    "sqlite",
    "typescript",
    "react",
    "angular",
)


def analyze_job_posting(payload: dict[str, str | None]) -> dict[str, object]:
    title = _normalize_text(payload.get("title")) or _extract_first_line(payload.get("description"))
    company = _normalize_text(payload.get("company"))
    location = _normalize_text(payload.get("location"))
    description = _normalize_text(payload.get("description")) or ""
    seniority = _detect_seniority((title, description))
    keywords = _extract_keywords(description)

    headline = title or "Untitled role"
    employer = company or "unknown company"
    summary = f"Placeholder analysis for {headline} at {employer}."

    return {
        "normalized_title": title,
        "normalized_company": company,
        "normalized_location": location,
        "seniority": seniority,
        "keywords": keywords,
        "summary": summary,
    }


def _extract_first_line(value: str | None) -> str | None:
    text = _normalize_text(value)
    if not text:
        return None

    first_line = text.splitlines()[0].strip()
    return first_line[:120] if first_line else None


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None

    collapsed = re.sub(r"\s+", " ", value).strip()
    return collapsed or None


def _detect_seniority(chunks: Iterable[str | None]) -> str:
    haystack = " ".join(chunk for chunk in chunks if chunk).lower()
    for hint, label in SENIORITY_HINTS.items():
        if hint in haystack:
            return label
    return "unknown"


def _extract_keywords(description: str) -> list[str]:
    haystack = description.lower()
    return [keyword for keyword in KEYWORD_HINTS if keyword in haystack]
