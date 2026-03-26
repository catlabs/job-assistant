from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from threading import Lock
from typing import Literal


FIT_TTL_MINUTES = 30


@dataclass(frozen=True)
class ExtractionFitCacheEntry:
    extraction_ref: str
    text_fingerprint: str
    fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"] | None
    fit_rationale: str
    expires_at: datetime


class ExtractionFitCache:
    def __init__(self) -> None:
        self._entries: dict[str, ExtractionFitCacheEntry] = {}
        self._lock = Lock()

    def put(
        self,
        *,
        extraction_ref: str,
        text_fingerprint: str,
        fit_classification: Literal["strong_fit", "acceptable_intermediate", "misaligned"] | None,
        fit_rationale: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        entry = ExtractionFitCacheEntry(
            extraction_ref=extraction_ref,
            text_fingerprint=text_fingerprint,
            fit_classification=fit_classification,
            fit_rationale=fit_rationale,
            expires_at=now + timedelta(minutes=FIT_TTL_MINUTES),
        )
        with self._lock:
            self._purge_expired_locked(now)
            self._entries[extraction_ref] = entry

    def get_matching(
        self, *, extraction_ref: str, text_fingerprint: str
    ) -> ExtractionFitCacheEntry | None:
        now = datetime.now(timezone.utc)
        with self._lock:
            self._purge_expired_locked(now)
            entry = self._entries.get(extraction_ref)
            if entry is None:
                return None
            if entry.text_fingerprint != text_fingerprint:
                return None
            return entry

    def _purge_expired_locked(self, now: datetime) -> None:
        expired_refs = [
            extraction_ref
            for extraction_ref, entry in self._entries.items()
            if entry.expires_at <= now
        ]
        for extraction_ref in expired_refs:
            self._entries.pop(extraction_ref, None)


@lru_cache
def get_extraction_fit_cache() -> ExtractionFitCache:
    return ExtractionFitCache()
