from __future__ import annotations

from pydantic import BaseModel, ValidationInfo, field_validator

from app.services.profile_rules import (
    MAX_DECISION_DIMENSIONS,
    MAX_INTERPRETATION_RULES,
    MAX_SIGNALS_PER_BUCKET,
    validate_classification_labels,
    validate_string_list,
)


class ProfileJobFitModel(BaseModel):
    strong_fit_signals: list[str]
    acceptable_but_intermediate_signals: list[str]
    misaligned_signals: list[str]


class ProfileJobFitModelUpdate(ProfileJobFitModel):
    strong_fit_signals: list[str]
    acceptable_but_intermediate_signals: list[str]
    misaligned_signals: list[str]

    @field_validator(
        "strong_fit_signals",
        "acceptable_but_intermediate_signals",
        "misaligned_signals",
    )
    @classmethod
    def validate_signals(cls, value: object, info: ValidationInfo) -> list[str]:
        field_name = info.field_name or "signals"
        return validate_string_list(
            value,
            field_name=field_name,
            max_items=MAX_SIGNALS_PER_BUCKET,
            require_non_empty=True,
        )


class ProfileAnalysisPreferences(BaseModel):
    classification_labels: list[str]
    interpretation_rules: list[str] = []
    decision_dimensions: list[str] = []


class ProfileAnalysisPreferencesUpdate(ProfileAnalysisPreferences):
    classification_labels: list[str]
    interpretation_rules: list[str] = []
    decision_dimensions: list[str] = []

    @field_validator("classification_labels")
    @classmethod
    def validate_labels(cls, value: object) -> list[str]:
        return validate_classification_labels(value)

    @field_validator("interpretation_rules")
    @classmethod
    def validate_interpretation_rules(cls, value: object) -> list[str]:
        return validate_string_list(
            value,
            field_name="interpretation_rules",
            max_items=MAX_INTERPRETATION_RULES,
            require_non_empty=False,
        )

    @field_validator("decision_dimensions")
    @classmethod
    def validate_decision_dimensions(cls, value: object) -> list[str]:
        return validate_string_list(
            value,
            field_name="decision_dimensions",
            max_items=MAX_DECISION_DIMENSIONS,
            require_non_empty=False,
        )


class ProfileUpdateRequest(BaseModel):
    profile_summary: str | None = None
    job_fit_model: ProfileJobFitModelUpdate
    analysis_preferences_for_job_assistant: ProfileAnalysisPreferencesUpdate

    @field_validator("profile_summary")
    @classmethod
    def validate_profile_summary(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ProfileResponse(BaseModel):
    profile_summary: str | None = None
    job_fit_model: ProfileJobFitModel
    analysis_preferences_for_job_assistant: ProfileAnalysisPreferences
    fit_analysis_enabled: bool
    explanation: str | None = None


class ProfileExplainResponse(BaseModel):
    enabled: bool
    message: str
    explanation: str | None = None
