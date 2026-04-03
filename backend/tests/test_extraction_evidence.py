import unittest

from app.schemas.extract_fields import JobCriteria, SignalEvidence
from app.services.job_criteria import build_job_criteria
from app.services.job_field_extraction import _validate_evidence_quotes


class ExtractionEvidenceTests(unittest.TestCase):
    def test_old_criteria_json_loads_with_empty_evidence_defaults(self) -> None:
        legacy_payload = """
        {
          "job_basics": {
            "title": "Backend Engineer",
            "company_name": "Example",
            "location_text": "Brussels",
            "country": "",
            "city": "",
            "employment_type": "unknown",
            "contract_type": "unknown",
            "seniority_level": "unknown",
            "job_summary": ""
          },
          "technical_signals": {
            "skills": [],
            "technical_notes": ""
          },
          "personal_life_signals": {
            "work_arrangement": "remote",
            "onsite_days_per_week": null,
            "fully_remote": null,
            "fully_onsite": null,
            "travel_required": null,
            "travel_percentage": null,
            "relocation_required": null,
            "schedule_flexibility_signal": "unknown",
            "personal_life_notes": ""
          },
          "financial_signals": {
            "estimated_compensation": {
              "estimated_salary_min": null,
              "estimated_salary_max": null,
              "estimated_daily_rate_min": null,
              "estimated_daily_rate_max": null,
              "estimated_currency": "unknown",
              "confidence": "unknown",
              "basis": ""
            },
            "salary_min": null,
            "salary_max": null,
            "salary_currency": "unknown",
            "salary_period": "unknown",
            "daily_rate_min": null,
            "daily_rate_max": null,
            "bonus_mentioned": null,
            "equity_mentioned": null,
            "financial_clarity": "low",
            "financial_notes": ""
          },
          "strategic_signals": {
            "ai_exposure_signal": "unknown",
            "product_ownership_signal": "unknown",
            "delivery_scope_signal": "unknown",
            "learning_potential_signal": "unknown",
            "market_value_signal": "unknown",
            "building_role": null,
            "annotation_or_evaluation_only": null,
            "strategic_notes": ""
          },
          "extraction_quality": {
            "confidence_level": "low",
            "missing_critical_information": [],
            "ambiguity_notes": ""
          }
        }
        """

        criteria = JobCriteria.model_validate_json(legacy_payload)

        self.assertEqual(criteria.personal_life_signals.work_arrangement_evidence.quotes, [])
        self.assertEqual(criteria.financial_signals.salary_min_evidence.quotes, [])
        self.assertEqual(criteria.strategic_signals.ai_exposure_signal_evidence.quotes, [])

    def test_invalid_quotes_are_dropped_when_not_found_in_raw_text(self) -> None:
        raw_text = (
            "Remote-first role based in Brussels.\n"
            "Travel up to 25% across Europe.\n"
            "Bonus available."
        )
        criteria = JobCriteria()
        criteria.personal_life_signals.travel_required = True
        criteria.personal_life_signals.travel_required_evidence = SignalEvidence(
            quotes=["Travel up to 25% across Europe.", "Travel up to 40% globally."],
            rationale="Only keep verbatim support.",
        )

        validated = _validate_evidence_quotes(criteria=criteria, raw_text=raw_text)

        self.assertEqual(
            validated.personal_life_signals.travel_required_evidence.quotes,
            ["Travel up to 25% across Europe."],
        )

    def test_financial_clarity_evidence_is_cleared_when_heuristic_overwrites_value(self) -> None:
        base_criteria = JobCriteria()
        base_criteria.financial_signals.salary_min = 120000
        base_criteria.financial_signals.salary_max = 150000
        base_criteria.financial_signals.salary_currency = "EUR"
        base_criteria.financial_signals.salary_period = "yearly"
        base_criteria.financial_signals.financial_clarity = "low"
        base_criteria.financial_signals.financial_clarity_evidence = SignalEvidence(
            quotes=["Compensation is competitive."],
        )

        criteria = build_job_criteria(
            title="Senior Engineer",
            company="Example",
            location="Brussels",
            description="Salary: EUR 120k - EUR 150k per year.",
            base_criteria=base_criteria,
        )

        self.assertEqual(criteria.financial_signals.financial_clarity, "high")
        self.assertEqual(criteria.financial_signals.financial_clarity_evidence.quotes, [])


if __name__ == "__main__":
    unittest.main()
