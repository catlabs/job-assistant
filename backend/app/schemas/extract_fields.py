import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.job import DecisionAnalysisV2, JobDecisionV1, JobDimensionAssessment
from app.services.extraction_models import get_allowed_extraction_models

SENIORITY_LEVELS: tuple[str, ...] = ("Intern", "Junior", "Mid", "Senior", "Lead", "Staff", "")
MIN_RAW_TEXT_LENGTH = 40
MAX_RAW_TEXT_LENGTH = 100_000


def _collapse(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


class ExtractFieldsRequest(BaseModel):
    raw_text: str = Field(
        min_length=1,
        max_length=MAX_RAW_TEXT_LENGTH,
        description="Raw pasted job posting text.",
    )
    model: str | None = Field(
        default=None,
        description="Optional extraction model override from a curated backend allowlist.",
    )

    @field_validator("raw_text")
    @classmethod
    def validate_raw_text(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < MIN_RAW_TEXT_LENGTH:
            raise ValueError(f"raw_text must contain at least {MIN_RAW_TEXT_LENGTH} characters.")
        return value

    @field_validator("model")
    @classmethod
    def validate_model(cls, value: str | None) -> str | None:
        if value is None:
            return None

        allowed_models = get_allowed_extraction_models()
        if value not in allowed_models:
            allowed_values = ", ".join(allowed_models)
            raise ValueError(f"model must be one of: {allowed_values}")
        return value


class ExtractionModelsResponse(BaseModel):
    default_model: str
    models: list[str] = Field(default_factory=list)


class ExtractedJobFields(BaseModel):
    title: str = ""
    company: str = ""
    location: str = ""
    work_arrangement: Literal["remote", "hybrid", "onsite", "unknown"] = "unknown"
    compensation_display: str = ""
    seniority: Literal["Intern", "Junior", "Mid", "Senior", "Lead", "Staff", ""] = ""
    summary: str = ""
    keywords: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("title", "company", "location", "compensation_display", "summary")
    @classmethod
    def normalize_text_fields(cls, value: str) -> str:
        return _collapse(value)

    @field_validator("keywords")
    @classmethod
    def normalize_keywords(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for item in value:
            cleaned = _collapse(item).lower()
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            normalized.append(cleaned)

        return normalized[:8]


class ExtractFieldsResponse(ExtractedJobFields):
    raw_text: str
    extraction_ref: str | None = None
    fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"] | None = None
    fit_rationale: str = ""
    decision: JobDecisionV1 | None = None
    dimension_assessment: JobDimensionAssessment | None = None
    decision_v2: DecisionAnalysisV2 | None = None
