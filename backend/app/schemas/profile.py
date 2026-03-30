from __future__ import annotations

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from app.services.profile_rules import (
    MAX_BRUSSELS_ONSITE_DAYS_PER_WEEK,
    MAX_DECISION_DIMENSIONS,
    MAX_FAR_LOCATIONS_TRAVEL_DAYS_PER_MONTH,
    MAX_INTERPRETATION_RULES,
    MAX_LOCATION_PREFERENCE_NOTE_LENGTH,
    MAX_NEARBY_CITIES_ONSITE_DAYS_PER_PERIOD,
    MAX_NEARBY_CITIES_PERIOD_WEEKS,
    MAX_SIGNALS_PER_BUCKET,
    validate_classification_labels,
    validate_optional_string,
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


class ProfileFinancialBaseline(BaseModel):
    amount: float
    currency: str
    basis: str
    hours_per_week: float | None = None
    days_per_year: float | None = None


class ProfileStrategicPreferences(BaseModel):
    risk_tolerance: str | None = None
    time_horizon: str | None = None
    career_stage: str | None = None
    non_negotiables: list[str] = []


class ProfileLocationPreferencesBrussels(BaseModel):
    max_onsite_days_per_week: int | None = Field(
        default=None,
        ge=0,
        le=MAX_BRUSSELS_ONSITE_DAYS_PER_WEEK,
    )
    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: object) -> str | None:
        return validate_optional_string(
            value,
            field_name="brussels.notes",
            max_length=MAX_LOCATION_PREFERENCE_NOTE_LENGTH,
        )


class ProfileLocationPreferencesNearbyCities(BaseModel):
    max_onsite_days_per_period: int | None = Field(
        default=None,
        ge=0,
        le=MAX_NEARBY_CITIES_ONSITE_DAYS_PER_PERIOD,
    )
    period_weeks: int | None = Field(
        default=None,
        ge=1,
        le=MAX_NEARBY_CITIES_PERIOD_WEEKS,
    )
    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: object) -> str | None:
        return validate_optional_string(
            value,
            field_name="nearby_cities.notes",
            max_length=MAX_LOCATION_PREFERENCE_NOTE_LENGTH,
        )


class ProfileLocationPreferencesFarLocations(BaseModel):
    remote_required: bool | None = None
    max_travel_days_per_month: int | None = Field(
        default=None,
        ge=0,
        le=MAX_FAR_LOCATIONS_TRAVEL_DAYS_PER_MONTH,
    )
    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: object) -> str | None:
        return validate_optional_string(
            value,
            field_name="far_locations.notes",
            max_length=MAX_LOCATION_PREFERENCE_NOTE_LENGTH,
        )


class ProfileLocationPreferences(BaseModel):
    brussels: ProfileLocationPreferencesBrussels | None = None
    nearby_cities: ProfileLocationPreferencesNearbyCities | None = None
    far_locations: ProfileLocationPreferencesFarLocations | None = None


class ProfileUpdateRequest(BaseModel):
    profile_summary: str | None = None
    job_fit_model: ProfileJobFitModelUpdate
    analysis_preferences_for_job_assistant: ProfileAnalysisPreferencesUpdate
    financial_baseline_for_job_assistant: ProfileFinancialBaseline | None = None
    strategic_preferences_for_job_assistant: ProfileStrategicPreferences | None = None
    location_preferences_for_job_assistant: ProfileLocationPreferences | None = None

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
    financial_baseline_for_job_assistant: ProfileFinancialBaseline | None = None
    strategic_preferences_for_job_assistant: ProfileStrategicPreferences | None = None
    location_preferences_for_job_assistant: ProfileLocationPreferences | None = None
    fit_analysis_enabled: bool
    explanation: str | None = None


class ProfileExplainResponse(BaseModel):
    enabled: bool
    message: str
    explanation: str | None = None
