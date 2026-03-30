from dataclasses import dataclass, field
import re
from typing import Literal

WorkArrangement = Literal["remote", "hybrid", "onsite", "unknown"]
LocationCategory = Literal["brussels", "belgium_other", "nearby_foreign", "far_foreign", "unknown"]
LifestyleFit = Literal["compatible", "constrained", "incompatible", "unknown"]

BRUSSELS_HINTS = ("brussels", "bruxelles", "brussel")
BELGIUM_HINTS = (
    "belgium",
    "belgique",
    "belgie",
    "antwerp",
    "antwerpen",
    "ghent",
    "gent",
    "leuven",
    "liege",
    "liege",
    "namur",
    "charleroi",
    "bruges",
    "brugge",
    "mechelen",
    "hasselt",
)
NEARBY_FOREIGN_HINTS = (
    "paris",
    "amsterdam",
    "rotterdam",
    "the hague",
    "den haag",
    "luxembourg",
    "luxembourg city",
    "lille",
    "netherlands",
    "france",
    "luxembourg",
)
FAR_FOREIGN_HINTS = (
    "london",
    "berlin",
    "munich",
    "dublin",
    "madrid",
    "barcelona",
    "lisbon",
    "porto",
    "new york",
    "san francisco",
    "seattle",
    "boston",
    "toronto",
    "vancouver",
    "singapore",
    "dubai",
    "united kingdom",
    "uk",
    "germany",
    "ireland",
    "spain",
    "portugal",
    "united states",
    "usa",
    "canada",
)


@dataclass(frozen=True)
class JobLifestyleSignals:
    work_arrangement: WorkArrangement
    location_category: LocationCategory
    relocation_required: bool = False
    travel_requirement_percent: int | None = None
    onsite_days_per_week: int | None = None
    onsite_days_per_period: int | None = None
    onsite_period_weeks: int | None = None
    signal_summary: str = "No strong lifestyle signals found."
    evidence: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class LifestylePreassessment:
    lifestyle_fit: LifestyleFit
    hard_blocker: bool = False
    rationale: str = ""


def derive_work_arrangement(*parts: str | None) -> WorkArrangement:
    haystack = " ".join(part for part in parts if part).lower()
    if not haystack:
        return "unknown"

    if re.search(r"\b(?:hybrid|split between home and office|office and home)\b", haystack):
        return "hybrid"
    if re.search(r"\b\d+\s*(?:days?|x)\s*(?:in|on)\s*(?:the )?office\b", haystack):
        return "hybrid"
    if re.search(r"\b(?:remote-first|fully remote|work from home|wfh|telecommute|distributed team)\b", haystack):
        return "remote"
    if re.search(r"\bremote\b", haystack) and not re.search(r"\b(?:no remote|not remote|non-remote)\b", haystack):
        return "remote"
    if re.search(r"\b(?:on-site|onsite|office-based|site-based|in office)\b", haystack):
        return "onsite"

    return "unknown"


def extract_lifestyle_signals(
    *,
    title: str | None,
    location: str | None,
    description: str | None,
) -> JobLifestyleSignals:
    haystack = " ".join(part for part in (title, location, description) if part).lower()
    work_arrangement = derive_work_arrangement(title, location, description)
    location_category = _detect_location_category(location, description)
    relocation_required = _detect_relocation_requirement(haystack)
    travel_requirement_percent = _extract_travel_requirement_percent(haystack)
    onsite_days_per_week = _extract_onsite_days_per_week(haystack)
    onsite_days_per_period, onsite_period_weeks = _extract_periodic_onsite_pattern(haystack)

    evidence: list[str] = []
    if location_category != "unknown":
        evidence.append(f"location_category={location_category}")
    if work_arrangement != "unknown":
        evidence.append(f"work_arrangement={work_arrangement}")
    if onsite_days_per_week is not None:
        evidence.append(f"onsite_days_per_week={onsite_days_per_week}")
    if onsite_days_per_period is not None and onsite_period_weeks is not None:
        evidence.append(
            f"onsite_days_per_period={onsite_days_per_period}/{onsite_period_weeks}w"
        )
    if travel_requirement_percent is not None:
        evidence.append(f"travel_requirement_percent={travel_requirement_percent}")
    if relocation_required:
        evidence.append("relocation_required=true")

    signal_summary = ", ".join(evidence) if evidence else "No strong lifestyle signals found."
    return JobLifestyleSignals(
        work_arrangement=work_arrangement,
        location_category=location_category,
        relocation_required=relocation_required,
        travel_requirement_percent=travel_requirement_percent,
        onsite_days_per_week=onsite_days_per_week,
        onsite_days_per_period=onsite_days_per_period,
        onsite_period_weeks=onsite_period_weeks,
        signal_summary=signal_summary,
        evidence=evidence,
    )


def derive_lifestyle_preassessment(
    *,
    signals: JobLifestyleSignals,
    location_preferences: dict[str, object] | None,
) -> LifestylePreassessment:
    if signals.travel_requirement_percent is not None and signals.travel_requirement_percent > 20:
        return LifestylePreassessment(
            lifestyle_fit="incompatible",
            hard_blocker=True,
            rationale="Travel requirement exceeds 20%.",
        )

    if signals.relocation_required and signals.location_category in {"nearby_foreign", "far_foreign"}:
        return LifestylePreassessment(
            lifestyle_fit="incompatible",
            hard_blocker=True,
            rationale="Role appears to require relocation outside Belgium.",
        )

    if signals.work_arrangement == "onsite":
        return LifestylePreassessment(
            lifestyle_fit="incompatible",
            hard_blocker=True,
            rationale="Role appears fully onsite.",
        )

    if signals.location_category == "brussels":
        allowed_days = _get_nested_int(
            location_preferences,
            ("brussels", "max_onsite_days_per_week"),
            default=3,
        )
        if signals.onsite_days_per_week is None:
            if signals.work_arrangement == "hybrid":
                return LifestylePreassessment(
                    lifestyle_fit="constrained",
                    rationale="Brussels role looks hybrid, but onsite cadence is not explicit.",
                )
            if signals.work_arrangement == "remote":
                return LifestylePreassessment(
                    lifestyle_fit="compatible",
                    rationale="Remote work is feasible for Brussels-based roles.",
                )
            return LifestylePreassessment(lifestyle_fit="unknown", rationale="Brussels role lacks clear onsite detail.")
        if signals.onsite_days_per_week <= allowed_days:
            return LifestylePreassessment(
                lifestyle_fit="compatible",
                rationale=f"Brussels onsite expectation stays within about {allowed_days} day(s) per week.",
            )
        return LifestylePreassessment(
            lifestyle_fit="constrained",
            rationale=f"Brussels onsite expectation exceeds about {allowed_days} day(s) per week.",
        )

    if signals.location_category == "belgium_other":
        if signals.onsite_days_per_week is None:
            if signals.work_arrangement == "remote":
                return LifestylePreassessment(
                    lifestyle_fit="compatible",
                    rationale="Belgium-based remote work is feasible.",
                )
            if signals.work_arrangement == "hybrid":
                return LifestylePreassessment(
                    lifestyle_fit="constrained",
                    rationale="Belgium role looks hybrid, but commute frequency is unclear.",
                )
            return LifestylePreassessment(
                lifestyle_fit="unknown",
                rationale="Belgium-based role lacks clear commute cadence.",
            )
        if signals.onsite_days_per_week <= 1:
            return LifestylePreassessment(
                lifestyle_fit="compatible",
                rationale="Belgium commute appears limited to about one onsite day per week.",
            )
        return LifestylePreassessment(
            lifestyle_fit="constrained",
            rationale="Belgium commute appears heavier than about one onsite day per week.",
        )

    if signals.location_category == "nearby_foreign":
        allowed_days = _get_nested_int(
            location_preferences,
            ("nearby_cities", "max_onsite_days_per_period"),
            default=1,
        )
        allowed_period = _get_nested_int(
            location_preferences,
            ("nearby_cities", "period_weeks"),
            default=2,
        )
        if (
            signals.onsite_days_per_period is not None
            and signals.onsite_period_weeks is not None
            and signals.onsite_days_per_period <= allowed_days
            and signals.onsite_period_weeks >= allowed_period
        ):
            return LifestylePreassessment(
                lifestyle_fit="compatible",
                rationale=(
                    "Nearby foreign commute looks limited to roughly "
                    f"{allowed_days} day(s) every {allowed_period} week(s) or less."
                ),
            )
        if signals.work_arrangement == "remote":
            max_travel_days = _get_nested_int(
                location_preferences,
                ("far_locations", "max_travel_days_per_month"),
                default=2,
            )
            if signals.travel_requirement_percent is None or signals.travel_requirement_percent <= 10:
                return LifestylePreassessment(
                    lifestyle_fit="compatible",
                    rationale=(
                        "Nearby foreign role appears remote-first with limited travel. "
                        f"Monthly travel budget is roughly {max_travel_days} day(s)."
                    ),
                )
        return LifestylePreassessment(
            lifestyle_fit="constrained",
            rationale="Nearby foreign role may be feasible only with low onsite frequency.",
        )

    if signals.location_category == "far_foreign":
        remote_required = _get_nested_bool(
            location_preferences,
            ("far_locations", "remote_required"),
        )
        if remote_required and signals.work_arrangement != "remote":
            return LifestylePreassessment(
                lifestyle_fit="incompatible",
                hard_blocker=True,
                rationale="Far location does not appear remote-first.",
            )
        if signals.work_arrangement == "remote":
            max_travel_days = _get_nested_int(
                location_preferences,
                ("far_locations", "max_travel_days_per_month"),
                default=2,
            )
            return LifestylePreassessment(
                lifestyle_fit="constrained",
                rationale=(
                    "Far location looks remote-first, but travel should stay minimal at roughly "
                    f"{max_travel_days} day(s) per month."
                ),
            )
        return LifestylePreassessment(
            lifestyle_fit="constrained",
            rationale="Far location appears difficult without clear remote support.",
        )

    if signals.work_arrangement == "remote":
        return LifestylePreassessment(
            lifestyle_fit="compatible",
            rationale="Remote work arrangement appears compatible.",
        )
    if signals.work_arrangement == "hybrid":
        return LifestylePreassessment(
            lifestyle_fit="constrained",
            rationale="Hybrid work arrangement is present, but commute specifics remain unclear.",
        )
    return LifestylePreassessment(
        lifestyle_fit="unknown",
        rationale="Location and work arrangement signals are too limited for a confident lifestyle call.",
    )


def extract_compensation_display(description: str | None) -> str | None:
    text = description or ""
    if not text.strip():
        return None

    range_patterns = (
        (
            re.compile(
                r"([$€£])\s*([\d,]{2,}(?:\.\d{1,2})?)\s*(?:-|to)\s*\1?\s*([\d,]{2,}(?:\.\d{1,2})?)\s*(per year|/year|annually|annual|per hour|/hour|hourly|per day|/day|daily rate)?",
                re.I,
            ),
            _format_range_display,
        ),
    )
    single_patterns = (
        (
            re.compile(
                r"([$€£])\s*([\d,]{1,}(?:\.\d{1,2})?)\s*(per year|/year|annually|annual|per hour|/hour|hourly|per day|/day|daily rate)",
                re.I,
            ),
            _format_single_display,
        ),
    )

    for pattern, formatter in range_patterns:
        match = pattern.search(text)
        if match:
            return formatter(match)

    for pattern, formatter in single_patterns:
        match = pattern.search(text)
        if match:
            return formatter(match)

    return None


def _format_range_display(match: re.Match[str]) -> str:
    currency_symbol = match.group(1)
    low = _format_number(match.group(2))
    high = _format_number(match.group(3))
    basis = _format_basis(match.group(4))
    return f"{currency_symbol}{low} - {currency_symbol}{high}{basis}"


def _format_single_display(match: re.Match[str]) -> str:
    currency_symbol = match.group(1)
    amount = _format_number(match.group(2))
    basis = _format_basis(match.group(3))
    return f"{currency_symbol}{amount}{basis}"


def _format_number(raw: str) -> str:
    if "." in raw:
        value = float(raw.replace(",", ""))
        return f"{value:,.2f}".rstrip("0").rstrip(".")
    return f"{int(raw.replace(',', '')):,}"


def _format_basis(raw: str | None) -> str:
    if not raw:
        return ""

    basis = raw.lower().strip()
    if basis in {"per year", "/year", "annually", "annual"}:
        return " / year"
    if basis in {"per hour", "/hour", "hourly"}:
        return " / hour"
    if basis in {"per day", "/day", "daily rate"}:
        return " / day"
    return ""


def _detect_location_category(location: str | None, description: str | None) -> LocationCategory:
    haystack = " ".join(part for part in (location, description) if part).lower()
    if any(hint in haystack for hint in BRUSSELS_HINTS):
        return "brussels"
    if any(hint in haystack for hint in BELGIUM_HINTS):
        return "belgium_other"
    if any(hint in haystack for hint in NEARBY_FOREIGN_HINTS):
        return "nearby_foreign"
    if any(hint in haystack for hint in FAR_FOREIGN_HINTS):
        return "far_foreign"
    return "unknown"


def _detect_relocation_requirement(haystack: str) -> bool:
    patterns = (
        r"\brelocat(?:e|ion|ing)\b",
        r"\bmust be based in\b",
        r"\bmust live in\b",
        r"\brequired to be in\b",
        r"\bmust work from\b",
    )
    return any(re.search(pattern, haystack) for pattern in patterns)


def _extract_travel_requirement_percent(haystack: str) -> int | None:
    patterns = (
        re.compile(r"\btravel[^.\n]{0,24}?(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*%", re.I),
        re.compile(r"\b(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*%[^.\n]{0,24}?travel", re.I),
    )
    for pattern in patterns:
        match = pattern.search(haystack)
        if not match:
            continue
        high_bound = match.group(2) or match.group(1)
        return int(high_bound)
    return None


def _extract_onsite_days_per_week(haystack: str) -> int | None:
    patterns = (
        re.compile(
            r"\b(\d)\s*(?:days?|x)[^.\n]{0,30}\b(?:in (?:the )?office|office|onsite|on-site)\b[^.\n]{0,16}\b(?:per|a|/)?\s*week\b",
            re.I,
        ),
        re.compile(
            r"\b(?:in (?:the )?office|office|onsite|on-site)\b[^.\n]{0,20}\b(\d)\s*(?:days?|x)\s*(?:per|a|/)?\s*week\b",
            re.I,
        ),
        re.compile(
            r"\b(\d)\s*(?:days?|x)\s*(?:per|a|/)?\s*week\b[^.\n]{0,20}\b(?:in (?:the )?office|office|onsite|on-site)\b",
            re.I,
        ),
    )
    for pattern in patterns:
        match = pattern.search(haystack)
        if match:
            return int(match.group(1))
    return None


def _extract_periodic_onsite_pattern(haystack: str) -> tuple[int | None, int | None]:
    patterns = (
        re.compile(
            r"\b(\d)\s*(?:days?|x)[^.\n]{0,24}\b(?:in (?:the )?office|office|onsite|on-site)\b[^.\n]{0,18}\b(?:every|per)\s*(\d+)\s*weeks?\b",
            re.I,
        ),
        re.compile(
            r"\b(?:every|per)\s*(\d+)\s*weeks?\b[^.\n]{0,24}\b(\d)\s*(?:days?|x)[^.\n]{0,20}\b(?:in (?:the )?office|office|onsite|on-site)\b",
            re.I,
        ),
    )
    for pattern in patterns:
        match = pattern.search(haystack)
        if not match:
            continue
        if pattern.pattern.startswith(r"\b(\d)"):
            return int(match.group(1)), int(match.group(2))
        return int(match.group(2)), int(match.group(1))
    return None, None


def _get_nested_int(
    payload: dict[str, object] | None,
    path: tuple[str, str],
    *,
    default: int,
) -> int:
    if not isinstance(payload, dict):
        return default
    first = payload.get(path[0])
    if not isinstance(first, dict):
        return default
    value = first.get(path[1])
    if isinstance(value, int):
        return value
    return default


def _get_nested_bool(payload: dict[str, object] | None, path: tuple[str, str]) -> bool | None:
    if not isinstance(payload, dict):
        return None
    first = payload.get(path[0])
    if not isinstance(first, dict):
        return None
    value = first.get(path[1])
    if isinstance(value, bool):
        return value
    return None
