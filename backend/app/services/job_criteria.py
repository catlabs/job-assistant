from __future__ import annotations

from dataclasses import dataclass
import re

from app.schemas.extract_fields import (
    ContractType,
    DeliveryScopeSignal,
    EmploymentType,
    JobCriteria,
    JobCriteriaSkill,
    SalaryCurrency,
    SalaryPeriod,
    ScheduleFlexibilitySignal,
    SeniorityLevel,
    SignalStrength,
    SkillCategory,
)
from app.services.job_signal_extraction import extract_compensation_display, extract_lifestyle_signals

KNOWN_CITIES: dict[str, str] = {
    "brussels": "Belgium",
    "bruxelles": "Belgium",
    "brussel": "Belgium",
    "antwerp": "Belgium",
    "antwerpen": "Belgium",
    "ghent": "Belgium",
    "gent": "Belgium",
    "leuven": "Belgium",
    "liege": "Belgium",
    "namur": "Belgium",
    "charleroi": "Belgium",
    "bruges": "Belgium",
    "brugge": "Belgium",
    "mechelen": "Belgium",
    "hasselt": "Belgium",
    "amsterdam": "Netherlands",
    "rotterdam": "Netherlands",
    "paris": "France",
    "lille": "France",
    "luxembourg": "Luxembourg",
    "luxembourg city": "Luxembourg",
    "berlin": "Germany",
    "munich": "Germany",
    "london": "United Kingdom",
    "dublin": "Ireland",
    "madrid": "Spain",
    "barcelona": "Spain",
    "lisbon": "Portugal",
    "porto": "Portugal",
    "new york": "United States",
    "san francisco": "United States",
    "seattle": "United States",
    "boston": "United States",
    "toronto": "Canada",
    "vancouver": "Canada",
    "singapore": "Singapore",
    "dubai": "United Arab Emirates",
}
KNOWN_COUNTRIES: dict[str, str] = {
    "belgium": "Belgium",
    "belgique": "Belgium",
    "belgie": "Belgium",
    "netherlands": "Netherlands",
    "france": "France",
    "luxembourg": "Luxembourg",
    "germany": "Germany",
    "ireland": "Ireland",
    "spain": "Spain",
    "portugal": "Portugal",
    "united kingdom": "United Kingdom",
    "uk": "United Kingdom",
    "united states": "United States",
    "usa": "United States",
    "canada": "Canada",
    "singapore": "Singapore",
    "uae": "United Arab Emirates",
}
SENIORITY_PATTERNS: tuple[tuple[str, SeniorityLevel], ...] = (
    (r"\bprincipal\b", "principal"),
    (r"\bstaff\b", "staff"),
    (r"\blead\b", "lead"),
    (r"\bsenior\b", "senior"),
    (r"\bmid(?:-level)?\b", "mid"),
    (r"\bintermediate\b", "mid"),
    (r"\bjunior\b", "junior"),
)
SKILL_PATTERNS: tuple[tuple[str, SkillCategory, tuple[str, ...]], ...] = (
    ("Python", "programming_language", (r"\bpython\b",)),
    ("TypeScript", "programming_language", (r"\btypescript\b",)),
    ("JavaScript", "programming_language", (r"\bjavascript\b", r"\bnode\.?js\b")),
    ("SQL", "data_storage", (r"\bsql\b",)),
    ("FastAPI", "framework", (r"\bfastapi\b",)),
    ("Django", "framework", (r"\bdjango\b",)),
    ("Flask", "framework", (r"\bflask\b",)),
    ("React", "frontend", (r"\breact\b",)),
    ("Vue", "frontend", (r"\bvue(?:\.js)?\b",)),
    ("Angular", "frontend", (r"\bangular\b",)),
    ("Next.js", "frontend", (r"\bnext\.?js\b",)),
    ("Node.js", "backend", (r"\bnode\.?js\b",)),
    ("Express", "backend", (r"\bexpress\b",)),
    ("REST APIs", "backend", (r"\brest(?:ful)? api", r"\bapi design\b")),
    ("GraphQL", "backend", (r"\bgraphql\b",)),
    ("PostgreSQL", "data_storage", (r"\bpostgres(?:ql)?\b",)),
    ("MySQL", "data_storage", (r"\bmysql\b",)),
    ("SQLite", "data_storage", (r"\bsqlite\b",)),
    ("MongoDB", "data_storage", (r"\bmongodb\b",)),
    ("Redis", "data_storage", (r"\bredis\b",)),
    ("Docker", "devops", (r"\bdocker\b",)),
    ("Kubernetes", "cloud_infra", (r"\bkubernetes\b", r"\bk8s\b")),
    ("Terraform", "cloud_infra", (r"\bterraform\b",)),
    ("AWS", "cloud_infra", (r"\baws\b", r"\bamazon web services\b")),
    ("GCP", "cloud_infra", (r"\bgcp\b", r"\bgoogle cloud\b")),
    ("Azure", "cloud_infra", (r"\bazure\b",)),
    ("CI/CD", "delivery_tool", (r"\bci/cd\b", r"\bcontinuous integration\b", r"\bcontinuous delivery\b")),
    ("GitHub Actions", "delivery_tool", (r"\bgithub actions\b",)),
    ("GitLab CI", "delivery_tool", (r"\bgitlab ci\b",)),
    ("Pytest", "testing_quality", (r"\bpytest\b",)),
    ("Playwright", "testing_quality", (r"\bplaywright\b",)),
    ("Cypress", "testing_quality", (r"\bcypress\b",)),
    ("LLMs", "ai_data", (r"\bllms?\b", r"\blarge language models?\b")),
    ("OpenAI", "ai_data", (r"\bopenai\b",)),
    ("RAG", "ai_data", (r"\brag\b", r"\bretrieval[- ]augmented\b")),
    ("Machine Learning", "ai_data", (r"\bmachine learning\b", r"\bml\b")),
    ("Data Pipelines", "ai_data", (r"\bdata pipelines?\b",)),
    ("Microservices", "architecture_practice", (r"\bmicroservices?\b",)),
    ("Distributed Systems", "architecture_practice", (r"\bdistributed systems?\b",)),
)
REQUIRED_HINTS = ("required", "must have", "must-have", "need", "strong experience", "expertise")
PREFERRED_HINTS = ("preferred", "nice to have", "bonus", "plus", "ideally")


@dataclass(frozen=True)
class ParsedCompensation:
    salary_min: float | None = None
    salary_max: float | None = None
    daily_rate_min: float | None = None
    daily_rate_max: float | None = None
    currency: SalaryCurrency = "unknown"
    period: SalaryPeriod = "unknown"
    display: str = ""


def build_job_criteria(
    *,
    title: str | None,
    company: str | None,
    location: str | None,
    description: str,
    base_criteria: JobCriteria | None = None,
) -> JobCriteria:
    criteria = base_criteria.model_copy(deep=True) if base_criteria else JobCriteria()
    normalized_description = _collapse(description)
    basics = criteria.job_basics
    basics.title = basics.title or _collapse(title) or _extract_title(normalized_description)
    basics.company_name = basics.company_name or _collapse(company)
    basics.location_text = basics.location_text or _collapse(location)
    city, country = _infer_city_country(basics.location_text, normalized_description)
    basics.city = basics.city or city
    basics.country = basics.country or country
    if basics.employment_type == "unknown":
        basics.employment_type = _detect_employment_type(normalized_description)
    if basics.contract_type == "unknown":
        basics.contract_type = _detect_contract_type(normalized_description)
    if basics.seniority_level == "unknown":
        basics.seniority_level = _detect_seniority(basics.title, normalized_description)
    basics.job_summary = basics.job_summary or _build_summary(normalized_description)

    technical = criteria.technical_signals
    if not technical.skills:
        technical.skills = _extract_skills(normalized_description)
    technical.technical_notes = technical.technical_notes or _build_technical_notes(normalized_description)

    lifestyle = criteria.personal_life_signals
    lifestyle_signals = extract_lifestyle_signals(
        title=basics.title or title,
        location=basics.location_text or location,
        description=normalized_description,
    )
    if lifestyle.work_arrangement == "unknown":
        lifestyle.work_arrangement = lifestyle_signals.work_arrangement
    if lifestyle.onsite_days_per_week is None:
        lifestyle.onsite_days_per_week = lifestyle_signals.onsite_days_per_week
    if lifestyle.fully_remote is None and lifestyle.work_arrangement != "unknown":
        lifestyle.fully_remote = lifestyle.work_arrangement == "remote"
    if lifestyle.fully_onsite is None and lifestyle.work_arrangement != "unknown":
        lifestyle.fully_onsite = lifestyle.work_arrangement == "onsite"
    if lifestyle.travel_percentage is None:
        lifestyle.travel_percentage = lifestyle_signals.travel_requirement_percent
    if lifestyle.travel_required is None:
        lifestyle.travel_required = (
            True if lifestyle_signals.travel_requirement_percent and lifestyle_signals.travel_requirement_percent > 0 else None
        )
    if lifestyle.relocation_required is None:
        lifestyle.relocation_required = lifestyle_signals.relocation_required
    if lifestyle.schedule_flexibility_signal == "unknown":
        lifestyle.schedule_flexibility_signal = _detect_schedule_flexibility(normalized_description)
    lifestyle.personal_life_notes = lifestyle.personal_life_notes or _build_personal_life_notes(
        lifestyle_signals.signal_summary
    )

    financial = criteria.financial_signals
    compensation = _parse_compensation(normalized_description)
    if financial.salary_min is None:
        financial.salary_min = compensation.salary_min
    if financial.salary_max is None:
        financial.salary_max = compensation.salary_max
    if financial.daily_rate_min is None:
        financial.daily_rate_min = compensation.daily_rate_min
    if financial.daily_rate_max is None:
        financial.daily_rate_max = compensation.daily_rate_max
    if financial.salary_currency == "unknown":
        financial.salary_currency = compensation.currency
    if financial.salary_period == "unknown":
        financial.salary_period = compensation.period
    if financial.bonus_mentioned is None:
        financial.bonus_mentioned = _search_bool(normalized_description, (r"\bbonus\b",))
    if financial.equity_mentioned is None:
        financial.equity_mentioned = _search_bool(
            normalized_description,
            (r"\bequity\b", r"\bstock options?\b", r"\brsus?\b"),
        )
    if financial.financial_clarity == "low":
        financial.financial_clarity = _detect_financial_clarity(financial, compensation.display)
    financial.financial_notes = financial.financial_notes or compensation.display

    strategic = criteria.strategic_signals
    if strategic.ai_exposure_signal == "unknown":
        strategic.ai_exposure_signal = _detect_ai_exposure(normalized_description)
    if strategic.product_ownership_signal == "unknown":
        strategic.product_ownership_signal = _detect_product_ownership(normalized_description)
    if strategic.delivery_scope_signal == "unknown":
        strategic.delivery_scope_signal = _detect_delivery_scope(normalized_description, technical.skills)
    if strategic.learning_potential_signal == "unknown":
        strategic.learning_potential_signal = _detect_learning_potential(normalized_description)
    if strategic.market_value_signal == "unknown":
        strategic.market_value_signal = _detect_market_value(strategic, technical.skills)
    if strategic.building_role is None:
        strategic.building_role = _search_bool(
            normalized_description,
            (r"\bbuild(?:ing)?\b", r"\bgreenfield\b", r"\bdesign\b", r"\barchitect\b", r"\blaunch\b"),
        )
    if strategic.annotation_or_evaluation_only is None:
        strategic.annotation_or_evaluation_only = _search_bool(
            normalized_description,
            (
                r"\bannotation\b",
                r"\blabel(?:ing|ling)\b",
                r"\bevaluat(?:ion|or|ing)\b",
                r"\brater\b",
                r"\bcontent moderation\b",
            ),
        )
    strategic.strategic_notes = strategic.strategic_notes or _build_strategic_notes(strategic)

    quality = criteria.extraction_quality
    if not quality.missing_critical_information:
        quality.missing_critical_information = _list_missing_critical_information(criteria)
    if quality.confidence_level == "low":
        quality.confidence_level = _detect_confidence(criteria)
    quality.ambiguity_notes = quality.ambiguity_notes or _build_ambiguity_notes(criteria)

    return JobCriteria.model_validate(criteria.model_dump())


def _collapse(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _extract_title(description: str) -> str:
    if not description:
        return ""
    first_line = description.split("\n", 1)[0].strip()
    if not first_line:
        return ""
    return first_line[:120]


def _infer_city_country(location_text: str, description: str) -> tuple[str, str]:
    haystack = f"{location_text} {description}".lower()
    for city_hint, country in KNOWN_CITIES.items():
        if city_hint in haystack:
            return city_hint.title(), country
    for country_hint, country in KNOWN_COUNTRIES.items():
        if country_hint in haystack:
            return "", country
    return "", ""


def _detect_employment_type(description: str) -> EmploymentType:
    if re.search(r"\bpart[- ]time\b", description, re.I):
        return "part_time"
    if re.search(r"\bfreelance\b", description, re.I):
        return "freelance"
    if re.search(r"\bcontract(?:or)?\b", description, re.I):
        return "contract"
    if re.search(r"\bfull[- ]time\b", description, re.I):
        return "full_time"
    return "unknown"


def _detect_contract_type(description: str) -> ContractType:
    if re.search(r"\bfreelance\b", description, re.I):
        return "freelance"
    if re.search(r"\bconsult(?:ant|ing)\b", description, re.I):
        return "consulting"
    if re.search(r"\bfixed[- ]term\b|\btemporary contract\b", description, re.I):
        return "fixed_term"
    if re.search(r"\bpermanent\b|\bemployee\b|\bfull[- ]time\b", description, re.I):
        return "employee"
    return "unknown"


def _detect_seniority(title: str, description: str) -> SeniorityLevel:
    haystack = f"{title} {description}".lower()
    for pattern, seniority in SENIORITY_PATTERNS:
        if re.search(pattern, haystack):
            return seniority
    return "unknown"


def _build_summary(description: str) -> str:
    if not description:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", description)
    selected = [sentence.strip() for sentence in sentences if sentence.strip()][:3]
    if not selected:
        return description[:280]
    return " ".join(selected)[:420]


def _extract_skills(description: str) -> list[JobCriteriaSkill]:
    detected: list[JobCriteriaSkill] = []
    lowered = description.lower()
    for name, category, patterns in SKILL_PATTERNS:
        match = None
        for pattern in patterns:
            match = re.search(pattern, lowered, re.I)
            if match:
                break
        if not match:
            continue
        detected.append(
            JobCriteriaSkill(
                name=name,
                category=category,
                importance=_detect_skill_importance(lowered, match.start(), match.end()),
            )
        )
    return detected[:20]


def _detect_skill_importance(description: str, start: int, end: int):
    window = description[max(0, start - 100) : min(len(description), end + 100)]
    if any(hint in window for hint in REQUIRED_HINTS):
        return "required"
    if any(hint in window for hint in PREFERRED_HINTS):
        return "preferred"
    return "mentioned"


def _build_technical_notes(description: str) -> str:
    notes: list[str] = []
    if re.search(r"\bmicroservices?\b", description, re.I):
        notes.append("Mentions microservices.")
    if re.search(r"\bdistributed systems?\b", description, re.I):
        notes.append("Mentions distributed systems.")
    if re.search(r"\bapi design\b|\brest(?:ful)? api", description, re.I):
        notes.append("Includes API design or integration work.")
    return " ".join(notes)


def _detect_schedule_flexibility(description: str) -> ScheduleFlexibilitySignal:
    if re.search(r"\bflexible hours?\b|\basynchronous\b|\bwork from anywhere\b", description, re.I):
        return "high"
    if re.search(r"\bhybrid\b|\bcore hours?\b", description, re.I):
        return "medium"
    if re.search(r"\bshift\b|\bon-call\b|\bfixed schedule\b", description, re.I):
        return "low"
    return "unknown"


def _build_personal_life_notes(signal_summary: str) -> str:
    if not signal_summary or signal_summary == "No strong lifestyle signals found.":
        return ""
    return signal_summary


def _parse_compensation(description: str) -> ParsedCompensation:
    display = extract_compensation_display(description) or ""
    pattern = re.compile(
        r"([$€£])\s*(\d[\d,.]*(?:\.\d+)?\s*[kK]?)\s*(?:-|to)\s*\1?\s*(\d[\d,.]*(?:\.\d+)?\s*[kK]?)\s*(per year|/year|annually|annual|per month|/month|monthly|per hour|/hour|hourly|per day|/day|daily rate)?",
        re.I,
    )
    match = pattern.search(description)
    if match:
        minimum = _parse_number(match.group(2))
        maximum = _parse_number(match.group(3))
        currency = _symbol_to_currency(match.group(1))
        period = _compensation_period(match.group(4))
        if period == "daily":
            return ParsedCompensation(
                daily_rate_min=minimum,
                daily_rate_max=maximum,
                currency=currency,
                period=period,
                display=display,
            )
        return ParsedCompensation(
            salary_min=minimum,
            salary_max=maximum,
            currency=currency,
            period=period,
            display=display,
        )

    single_pattern = re.compile(
        r"([$€£])\s*(\d[\d,.]*(?:\.\d+)?\s*[kK]?)\s*(per year|/year|annually|annual|per month|/month|monthly|per hour|/hour|hourly|per day|/day|daily rate)",
        re.I,
    )
    single_match = single_pattern.search(description)
    if not single_match:
        return ParsedCompensation(display=display)

    amount = _parse_number(single_match.group(2))
    currency = _symbol_to_currency(single_match.group(1))
    period = _compensation_period(single_match.group(3))
    if period == "daily":
        return ParsedCompensation(
            daily_rate_min=amount,
            daily_rate_max=amount,
            currency=currency,
            period=period,
            display=display,
        )
    return ParsedCompensation(
        salary_min=amount,
        salary_max=amount,
        currency=currency,
        period=period,
        display=display,
    )


def _parse_number(raw: str) -> float:
    cleaned = raw.strip().lower().replace(",", "")
    multiplier = 1000.0 if cleaned.endswith("k") else 1.0
    numeric = cleaned[:-1] if cleaned.endswith("k") else cleaned
    return round(float(numeric) * multiplier, 2)


def _symbol_to_currency(symbol: str) -> SalaryCurrency:
    return {"€": "EUR", "$": "USD", "£": "GBP"}.get(symbol, "unknown")


def _compensation_period(raw: str | None) -> SalaryPeriod:
    if not raw:
        return "unknown"
    basis = raw.lower().strip()
    if basis in {"per year", "/year", "annually", "annual"}:
        return "yearly"
    if basis in {"per month", "/month", "monthly"}:
        return "monthly"
    if basis in {"per day", "/day", "daily rate"}:
        return "daily"
    if basis in {"per hour", "/hour", "hourly"}:
        return "hourly"
    return "unknown"


def _detect_financial_clarity(financial, display: str) -> str:
    if financial.salary_min is not None or financial.daily_rate_min is not None:
        if financial.salary_max is not None or financial.daily_rate_max is not None:
            return "high"
        return "medium"
    if display:
        return "medium"
    return "low"


def _detect_ai_exposure(description: str) -> SignalStrength:
    if re.search(r"\b(llm|large language model|openai|genai|generative ai|rag)\b", description, re.I):
        return "high"
    if re.search(r"\b(ai|artificial intelligence|machine learning|ml|data science)\b", description, re.I):
        return "medium"
    return "unknown"


def _detect_product_ownership(description: str) -> SignalStrength:
    if re.search(r"\bown(?:ership)?\b|\broadmap\b|\bproduct strategy\b|\bcustomer impact\b", description, re.I):
        return "high"
    if re.search(r"\bend-to-end\b|\bautonomous\b|\blead features\b", description, re.I):
        return "medium"
    if re.search(r"\bexecute tickets\b|\bmaintenance only\b|\bstrictly implement\b", description, re.I):
        return "low"
    return "unknown"


def _detect_delivery_scope(description: str, skills: list[JobCriteriaSkill]) -> DeliveryScopeSignal:
    categories = {skill.category for skill in skills}
    if "frontend" in categories and ("backend" in categories or "framework" in categories):
        return "full_stack"
    if "cloud_infra" in categories or "devops" in categories:
        return "platform"
    if "backend" in categories or re.search(r"\bapi\b|\bservices\b|\bbackend\b", description, re.I):
        return "backend_only"
    if "frontend" in categories or re.search(r"\bfrontend\b|\bui\b|\bux\b", description, re.I):
        return "frontend_only"
    if re.search(r"\bcross-functional\b|\bproduct\b|\bstakeholders?\b", description, re.I):
        return "cross_functional"
    return "unknown"


def _detect_learning_potential(description: str) -> SignalStrength:
    if re.search(r"\bgreenfield\b|\b0 to 1\b|\bnew product\b|\bscale\b|\bscaling\b", description, re.I):
        return "high"
    if re.search(r"\bownership\b|\bgrow\b|\bmentorship\b", description, re.I):
        return "medium"
    if re.search(r"\bmaintenance\b|\bsupport only\b|\bannotation\b", description, re.I):
        return "low"
    return "unknown"


def _detect_market_value(strategic, skills: list[JobCriteriaSkill]) -> SignalStrength:
    categories = {skill.category for skill in skills}
    if strategic.annotation_or_evaluation_only:
        return "low"
    if strategic.ai_exposure_signal == "high" or {"cloud_infra", "devops", "architecture_practice"} & categories:
        return "high"
    if {"backend", "frontend", "framework", "programming_language"} & categories:
        return "medium"
    return "unknown"


def _build_strategic_notes(strategic) -> str:
    notes: list[str] = []
    if strategic.ai_exposure_signal != "unknown":
        notes.append(f"AI exposure looks {strategic.ai_exposure_signal}.")
    if strategic.product_ownership_signal != "unknown":
        notes.append(f"Ownership signal looks {strategic.product_ownership_signal}.")
    if strategic.delivery_scope_signal != "unknown":
        notes.append(f"Delivery scope looks {strategic.delivery_scope_signal}.")
    return " ".join(notes)


def _list_missing_critical_information(criteria: JobCriteria) -> list[str]:
    missing: list[str] = []
    basics = criteria.job_basics
    if not basics.company_name:
        missing.append("company name")
    if not basics.location_text:
        missing.append("location")
    if basics.employment_type == "unknown":
        missing.append("employment type")
    if criteria.personal_life_signals.work_arrangement == "unknown":
        missing.append("work arrangement")
    if criteria.financial_signals.salary_period == "unknown" and criteria.financial_signals.daily_rate_min is None:
        missing.append("compensation")
    if not criteria.technical_signals.skills:
        missing.append("technical skills")
    return missing


def _detect_confidence(criteria: JobCriteria):
    missing_count = len(criteria.extraction_quality.missing_critical_information)
    skill_count = len(criteria.technical_signals.skills)
    basics = criteria.job_basics
    if basics.title and basics.company_name and skill_count >= 3 and missing_count <= 2:
        return "high"
    if (basics.title or basics.company_name) and skill_count >= 1 and missing_count <= 4:
        return "medium"
    return "low"


def _build_ambiguity_notes(criteria: JobCriteria) -> str:
    notes: list[str] = []
    if criteria.personal_life_signals.work_arrangement == "unknown":
        notes.append("Work arrangement is not explicit.")
    if criteria.financial_signals.financial_clarity == "low":
        notes.append("Compensation details are limited or absent.")
    if criteria.strategic_signals.delivery_scope_signal == "unknown":
        notes.append("Delivery scope is not explicit.")
    return " ".join(notes)


def _search_bool(description: str, patterns: tuple[str, ...]) -> bool | None:
    return True if any(re.search(pattern, description, re.I) for pattern in patterns) else None
