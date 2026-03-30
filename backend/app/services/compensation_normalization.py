from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DEFAULT_HOURS_PER_WEEK = 40.0
DEFAULT_DAYS_PER_YEAR = 260.0
WORK_DAYS_PER_WEEK = 5.0


@dataclass(frozen=True)
class NormalizedCompensation:
    amount: float
    currency: str
    basis: Literal["annual_salary", "daily_rate", "hourly"]
    annual_amount: float
    daily_amount: float
    hourly_amount: float
    hours_per_week: float
    days_per_year: float


@dataclass(frozen=True)
class CompensationComparisonHint:
    relation: Literal["below", "in_line", "above", "unknown"]
    summary: str


def normalize_compensation(
    *,
    amount: float,
    currency: str,
    basis: Literal["annual_salary", "daily_rate", "hourly"],
    hours_per_week: float | None = None,
    days_per_year: float | None = None,
) -> NormalizedCompensation | None:
    if amount <= 0:
        return None

    resolved_hours_per_week = hours_per_week if hours_per_week and hours_per_week > 0 else DEFAULT_HOURS_PER_WEEK
    resolved_days_per_year = days_per_year if days_per_year and days_per_year > 0 else DEFAULT_DAYS_PER_YEAR
    hours_per_day = resolved_hours_per_week / WORK_DAYS_PER_WEEK

    if hours_per_day <= 0:
        return None

    if basis == "annual_salary":
        annual_amount = amount
        daily_amount = annual_amount / resolved_days_per_year
        hourly_amount = daily_amount / hours_per_day
    elif basis == "daily_rate":
        daily_amount = amount
        annual_amount = daily_amount * resolved_days_per_year
        hourly_amount = daily_amount / hours_per_day
    else:
        hourly_amount = amount
        daily_amount = hourly_amount * hours_per_day
        annual_amount = daily_amount * resolved_days_per_year

    return NormalizedCompensation(
        amount=round(amount, 2),
        currency=currency,
        basis=basis,
        annual_amount=round(annual_amount, 2),
        daily_amount=round(daily_amount, 2),
        hourly_amount=round(hourly_amount, 2),
        hours_per_week=round(resolved_hours_per_week, 2),
        days_per_year=round(resolved_days_per_year, 2),
    )


def build_comparison_hint(
    *,
    user_baseline: NormalizedCompensation | None,
    job_compensation: NormalizedCompensation | None,
) -> CompensationComparisonHint:
    if user_baseline is None or job_compensation is None or user_baseline.annual_amount <= 0:
        return CompensationComparisonHint(relation="unknown", summary="Comparison unavailable due to limited compensation data.")

    delta_ratio = (job_compensation.annual_amount - user_baseline.annual_amount) / user_baseline.annual_amount
    if delta_ratio > 0.10:
        return CompensationComparisonHint(
            relation="above",
            summary=_ratio_summary(delta_ratio, "higher"),
        )
    if delta_ratio < -0.10:
        return CompensationComparisonHint(
            relation="below",
            summary=_ratio_summary(abs(delta_ratio), "lower"),
        )
    return CompensationComparisonHint(
        relation="in_line",
        summary="Estimated total compensation appears within about ±10% of your baseline.",
    )


def _ratio_summary(ratio: float, direction: str) -> str:
    if ratio <= 0.20:
        band = "~10–20%"
    elif ratio <= 0.35:
        band = "~20–35%"
    else:
        band = ">35%"
    return f"Estimated total compensation is {band} {direction} than your baseline."
