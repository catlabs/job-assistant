import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.schemas.extract_fields import EstimateCompensationRequest, ExtractFieldsRequest, JobCriteria
from app.services.job_field_extraction import JobFieldExtractionService


class JobFieldExtractionMockModeTests(unittest.IsolatedAsyncioTestCase):
    async def test_mock_extraction_returns_realistic_payload_with_empty_estimate(self) -> None:
        service = JobFieldExtractionService()
        payload = ExtractFieldsRequest(
            raw_text=(
                "Senior backend role with FastAPI, PostgreSQL, and cloud deployment ownership. "
                "Hybrid in Paris with two on-site days and product ownership."
            )
        )
        mock_settings = SimpleNamespace(
            mock_extraction=True,
            mock_extraction_delay_ms=0,
        )

        with patch("app.services.job_field_extraction.get_settings", return_value=mock_settings):
            response = await service.extract_fields(payload)

        self.assertTrue(response.criteria.job_basics.title)
        self.assertTrue(response.criteria.job_basics.company_name)
        self.assertGreater(len(response.criteria.technical_signals.skills), 0)
        self.assertEqual(response.criteria.financial_signals.estimated_compensation.estimated_currency, "unknown")
        self.assertIsNone(response.criteria.financial_signals.estimated_compensation.estimated_salary_min)
        self.assertIsNone(response.criteria.financial_signals.estimated_compensation.estimated_salary_max)


class CompensationMockModeTests(unittest.TestCase):
    def test_mock_compensation_success_returns_estimate(self) -> None:
        service = JobFieldExtractionService()
        payload = EstimateCompensationRequest(raw_text=("x" * 60), criteria=JobCriteria())
        mock_settings = SimpleNamespace(
            mock_compensation=True,
            mock_compensation_delay_ms=0,
            mock_compensation_mode="success",
        )

        with patch("app.services.job_field_extraction.get_settings", return_value=mock_settings):
            response = service.estimate_compensation(payload)

        self.assertEqual(response.status, "completed")
        self.assertEqual(response.estimated_compensation.estimated_currency, "EUR")
        self.assertEqual(response.estimated_compensation.confidence, "medium")
        self.assertIsNotNone(response.estimated_compensation.estimated_salary_min)
        self.assertIsNotNone(response.estimated_compensation.estimated_salary_max)

    def test_mock_compensation_skipped_matches_skipped_shape(self) -> None:
        service = JobFieldExtractionService()
        payload = EstimateCompensationRequest(raw_text=("x" * 60), criteria=JobCriteria())
        mock_settings = SimpleNamespace(
            mock_compensation=True,
            mock_compensation_delay_ms=0,
            mock_compensation_mode="skipped",
        )

        with patch("app.services.job_field_extraction.get_settings", return_value=mock_settings):
            response = service.estimate_compensation(payload)

        self.assertEqual(response.status, "skipped")
        self.assertEqual(response.reason, "estimation_not_needed")

    def test_mock_compensation_error_uses_failed_path(self) -> None:
        service = JobFieldExtractionService()
        payload = EstimateCompensationRequest(raw_text=("x" * 60), criteria=JobCriteria())
        mock_settings = SimpleNamespace(
            mock_compensation=True,
            mock_compensation_delay_ms=0,
            mock_compensation_mode="error",
        )

        with patch("app.services.job_field_extraction.get_settings", return_value=mock_settings):
            response = service.estimate_compensation(payload)

        self.assertEqual(response.status, "failed")
        self.assertEqual(response.reason, "compensation_estimation_unavailable")


if __name__ == "__main__":
    unittest.main()
