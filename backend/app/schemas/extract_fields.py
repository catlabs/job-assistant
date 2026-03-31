import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.services.extraction_models import get_allowed_extraction_models

EmploymentType = Literal["full_time", "freelance", "contract", "part_time", "unknown"]
ContractType = Literal["employee", "freelance", "consulting", "fixed_term", "unknown"]
SeniorityLevel = Literal["junior", "mid", "senior", "lead", "staff", "principal", "unknown"]
WorkArrangement = Literal["remote", "hybrid", "onsite", "unknown"]
ScheduleFlexibilitySignal = Literal["high", "medium", "low", "unknown"]
SalaryCurrency = Literal["EUR", "USD", "GBP", "unknown"]
SalaryPeriod = Literal["yearly", "monthly", "daily", "hourly", "unknown"]
SignalStrength = Literal["high", "medium", "low", "unknown"]
DeliveryScopeSignal = Literal[
    "full_stack",
    "backend_only",
    "frontend_only",
    "platform",
    "cross_functional",
    "unknown",
]
ConfidenceLevel = Literal["high", "medium", "low"]
EstimateConfidenceLevel = Literal["high", "medium", "low", "unknown"]
SkillCategory = Literal[
    "programming_language",
    "framework",
    "backend",
    "frontend",
    "ai_data",
    "cloud_infra",
    "devops",
    "testing_quality",
    "data_storage",
    "delivery_tool",
    "architecture_practice",
]
SkillImportance = Literal["required", "preferred", "mentioned"]

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


class JobCriteriaSkill(BaseModel):
    name: str = ""
    category: SkillCategory = "programming_language"
    importance: SkillImportance = "mentioned"

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return _collapse(value)


class JobBasics(BaseModel):
    title: str = ""
    company_name: str = ""
    location_text: str = ""
    country: str = ""
    city: str = ""
    employment_type: EmploymentType = "unknown"
    contract_type: ContractType = "unknown"
    seniority_level: SeniorityLevel = "unknown"
    job_summary: str = ""

    @field_validator("title", "company_name", "location_text", "country", "city", "job_summary")
    @classmethod
    def normalize_text_fields(cls, value: str) -> str:
        return _collapse(value)


class TechnicalSignals(BaseModel):
    skills: list[JobCriteriaSkill] = Field(default_factory=list)
    technical_notes: str = ""

    @field_validator("technical_notes")
    @classmethod
    def normalize_notes(cls, value: str) -> str:
        return _collapse(value)

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, value: list[JobCriteriaSkill]) -> list[JobCriteriaSkill]:
        normalized: list[JobCriteriaSkill] = []
        seen: set[tuple[str, SkillCategory, SkillImportance]] = set()
        for item in value:
            if not item.name:
                continue
            key = (item.name.lower(), item.category, item.importance)
            if key in seen:
                continue
            seen.add(key)
            normalized.append(item)
        return normalized[:20]


class PersonalLifeSignals(BaseModel):
    work_arrangement: WorkArrangement = "unknown"
    onsite_days_per_week: int | None = None
    fully_remote: bool | None = None
    fully_onsite: bool | None = None
    travel_required: bool | None = None
    travel_percentage: int | None = None
    relocation_required: bool | None = None
    schedule_flexibility_signal: ScheduleFlexibilitySignal = "unknown"
    personal_life_notes: str = ""

    @field_validator("personal_life_notes")
    @classmethod
    def normalize_notes(cls, value: str) -> str:
        return _collapse(value)


class FinancialSignals(BaseModel):
    class EstimatedCompensation(BaseModel):
        estimated_salary_min: float | None = None
        estimated_salary_max: float | None = None
        estimated_daily_rate_min: float | None = None
        estimated_daily_rate_max: float | None = None
        estimated_currency: SalaryCurrency = "unknown"
        confidence: EstimateConfidenceLevel = "unknown"
        basis: str = ""

        @field_validator("basis")
        @classmethod
        def normalize_basis(cls, value: str) -> str:
            return _collapse(value)

    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: SalaryCurrency = "unknown"
    salary_period: SalaryPeriod = "unknown"
    daily_rate_min: float | None = None
    daily_rate_max: float | None = None
    bonus_mentioned: bool | None = None
    equity_mentioned: bool | None = None
    financial_clarity: Literal["high", "medium", "low"] = "low"
    estimated_compensation: EstimatedCompensation = Field(default_factory=EstimatedCompensation)
    financial_notes: str = ""

    @field_validator("financial_notes")
    @classmethod
    def normalize_notes(cls, value: str) -> str:
        return _collapse(value)


class StrategicSignals(BaseModel):
    ai_exposure_signal: SignalStrength = "unknown"
    product_ownership_signal: SignalStrength = "unknown"
    delivery_scope_signal: DeliveryScopeSignal = "unknown"
    learning_potential_signal: SignalStrength = "unknown"
    market_value_signal: SignalStrength = "unknown"
    building_role: bool | None = None
    annotation_or_evaluation_only: bool | None = None
    strategic_notes: str = ""

    @field_validator("strategic_notes")
    @classmethod
    def normalize_notes(cls, value: str) -> str:
        return _collapse(value)


class ExtractionQuality(BaseModel):
    confidence_level: ConfidenceLevel = "low"
    missing_critical_information: list[str] = Field(default_factory=list)
    ambiguity_notes: str = ""

    @field_validator("missing_critical_information")
    @classmethod
    def normalize_missing(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for item in value:
            cleaned = _collapse(item)
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(cleaned)
        return normalized[:12]

    @field_validator("ambiguity_notes")
    @classmethod
    def normalize_notes(cls, value: str) -> str:
        return _collapse(value)


class JobCriteria(BaseModel):
    job_basics: JobBasics = Field(default_factory=JobBasics)
    technical_signals: TechnicalSignals = Field(default_factory=TechnicalSignals)
    personal_life_signals: PersonalLifeSignals = Field(default_factory=PersonalLifeSignals)
    financial_signals: FinancialSignals = Field(default_factory=FinancialSignals)
    strategic_signals: StrategicSignals = Field(default_factory=StrategicSignals)
    extraction_quality: ExtractionQuality = Field(default_factory=ExtractionQuality)


class ExtractFieldsResponse(BaseModel):
    raw_text: str
    criteria: JobCriteria = Field(default_factory=JobCriteria)
