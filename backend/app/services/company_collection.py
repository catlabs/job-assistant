from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from typing import Final
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

from app.core.config import get_settings
from app.schemas.company import CompanyPage, MAX_ADDITIONAL_SOURCE_URLS
from app.services.text_fingerprint import fingerprint_text

ALLOWED_PATHS: Final[tuple[str, ...]] = ("/", "/about", "/company", "/team", "/careers", "/jobs")
MAX_SUCCESSFUL_PAGES: Final[int] = 4
MAX_RESPONSE_BYTES: Final[int] = 500_000
MAX_PAGE_TEXT_CHARS: Final[int] = 4_000
MAX_COMBINED_TEXT_CHARS: Final[int] = 12_000
MAX_EXCERPT_CHARS: Final[int] = 280


class _HtmlTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self.parts: list[str] = []
        self.title_parts: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript"}:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self._skip_depth > 0:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return

        cleaned = " ".join(data.split())
        if not cleaned:
            return

        self.parts.append(cleaned)
        if self._in_title:
            self.title_parts.append(cleaned)


@dataclass
class CollectedCompanyData:
    source_url: str
    canonical_url: str
    normalized_host: str
    pages: list[CompanyPage]
    combined_text: str
    content_fingerprint: str | None
    fetched_at: datetime
    ingest_status: str
    errors: list[str]


@dataclass
class _FetchedPage:
    page: CompanyPage
    text: str


class CompanyCollectionService:
    def collect(self, source_url: str, *, additional_source_urls: list[str] | None = None) -> CollectedCompanyData:
        normalized_source_url, canonical_url, normalized_host = self._normalize_urls(source_url)
        priority_urls = self._normalize_additional_urls(
            additional_source_urls or [],
            source_url=normalized_source_url,
            canonical_url=canonical_url,
            normalized_host=normalized_host,
        )
        collection_targets = self._build_collection_targets(canonical_url, priority_urls)
        settings = get_settings()
        timeout = httpx.Timeout(settings.openai_timeout_seconds, connect=min(settings.openai_timeout_seconds, 10.0))
        pages: list[CompanyPage] = []
        successful_pages = 0
        missing_pages = 0
        combined_segments: list[str] = []
        combined_length = 0
        errors: list[str] = []
        stopped_due_to_cap = False

        with httpx.Client(timeout=timeout, follow_redirects=True, headers={"User-Agent": "job-assistant/companies"}) as client:
            for page_url, path_label in collection_targets:
                if successful_pages >= MAX_SUCCESSFUL_PAGES or combined_length >= MAX_COMBINED_TEXT_CHARS:
                    stopped_due_to_cap = True
                    break

                try:
                    fetched_page = self._fetch_page(
                        client,
                        normalized_host=normalized_host,
                        page_url=page_url,
                        path=path_label,
                    )
                except ValueError as exc:
                    errors.append(str(exc))
                    continue
                except httpx.HTTPError as exc:
                    errors.append(f"{page_url}: {exc.__class__.__name__}")
                    continue

                if fetched_page is None:
                    missing_pages += 1
                    continue

                pages.append(fetched_page.page)
                successful_pages += 1

                if fetched_page.text:
                    remaining = MAX_COMBINED_TEXT_CHARS - combined_length
                    if remaining > 0:
                        clipped = fetched_page.text[:remaining]
                        if clipped:
                            combined_segments.append(f"[{path_label}] {clipped}")
                            combined_length += len(clipped)

        combined_text = "\n\n".join(combined_segments).strip()
        if successful_pages == 0:
            ingest_status = "failed"
        elif errors or (not stopped_due_to_cap and missing_pages > 0):
            ingest_status = "partial"
        else:
            ingest_status = "complete"

        return CollectedCompanyData(
            source_url=normalized_source_url,
            canonical_url=canonical_url,
            normalized_host=normalized_host,
            pages=pages,
            combined_text=combined_text,
            content_fingerprint=fingerprint_text(combined_text) if combined_text else None,
            fetched_at=datetime.now(timezone.utc),
            ingest_status=ingest_status,
            errors=errors,
        )

    def _normalize_urls(self, source_url: str) -> tuple[str, str, str]:
        candidate = source_url.strip()
        if not candidate:
            raise ValueError("Company URL is required.")

        if "://" not in candidate:
            candidate = f"https://{candidate}"

        parsed = urlparse(candidate)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Company URL must be a valid http or https URL.")

        normalized_host = (parsed.hostname or "").strip().lower()
        if not normalized_host:
            raise ValueError("Company URL must include a valid host.")

        canonical_netloc = normalized_host
        if parsed.port:
            canonical_netloc = f"{canonical_netloc}:{parsed.port}"

        source_path = parsed.path or "/"
        normalized_source_url = urlunparse(
            (parsed.scheme.lower(), canonical_netloc, source_path, "", parsed.query, "")
        )
        canonical_url = urlunparse((parsed.scheme.lower(), canonical_netloc, "/", "", "", "")).rstrip("/")
        return normalized_source_url, canonical_url, normalized_host

    def _normalize_additional_urls(
        self,
        additional_source_urls: list[str],
        *,
        source_url: str,
        canonical_url: str,
        normalized_host: str,
    ) -> list[str]:
        if len(additional_source_urls) > MAX_ADDITIONAL_SOURCE_URLS:
            raise ValueError(f"You can add up to {MAX_ADDITIONAL_SOURCE_URLS} additional source URLs.")

        normalized: list[str] = []
        seen: set[str] = {
            self._url_identity(source_url),
            self._url_identity(canonical_url),
        }
        domain_root = self._normalize_domain_root(normalized_host)

        for raw_url in additional_source_urls:
            candidate = raw_url.strip()
            if not candidate:
                continue

            normalized_url, _, candidate_host = self._normalize_urls(candidate)
            if not self._is_same_company_domain(candidate_host, domain_root):
                raise ValueError("Additional source URLs must stay on the same company domain as the main website.")

            normalized_identity = self._url_identity(normalized_url)
            if normalized_identity in seen:
                continue

            seen.add(normalized_identity)
            normalized.append(normalized_url)

        return normalized

    def _build_collection_targets(self, canonical_url: str, priority_urls: list[str]) -> list[tuple[str, str]]:
        targets: list[tuple[str, str]] = []
        seen_urls: set[str] = set()

        def add_target(url: str, label: str) -> None:
            identity = self._url_identity(url)
            if identity in seen_urls:
                return
            seen_urls.add(identity)
            targets.append((url, label))

        for priority_url in priority_urls:
            add_target(priority_url, self._label_for_url(priority_url))

        for path in ALLOWED_PATHS:
            add_target(urljoin(canonical_url, path), path)

        return targets

    def _label_for_url(self, page_url: str) -> str:
        parsed = urlparse(page_url)
        if parsed.path and parsed.path != "/":
            return parsed.path
        return "/"

    def _normalize_domain_root(self, host: str) -> str:
        normalized = host.strip().lower()
        if normalized.startswith("www."):
            return normalized[4:]
        return normalized

    def _url_identity(self, page_url: str) -> str:
        parsed = urlparse(page_url)
        host = (parsed.hostname or "").lower()
        port = f":{parsed.port}" if parsed.port else ""
        path = parsed.path or "/"
        return f"{host}{port}{path}?{parsed.query}"

    def _is_same_company_domain(self, host: str, domain_root: str) -> bool:
        normalized_host = self._normalize_domain_root(host)
        return normalized_host == domain_root or normalized_host.endswith(f".{domain_root}")

    def _fetch_page(
        self,
        client: httpx.Client,
        *,
        normalized_host: str,
        page_url: str,
        path: str,
    ) -> _FetchedPage | None:
        with client.stream("GET", page_url) as response:
            parsed_final_url = urlparse(str(response.url))
            final_host = (parsed_final_url.hostname or "").lower()
            if not self._is_same_company_domain(final_host, self._normalize_domain_root(normalized_host)):
                raise ValueError(f"{page_url}: redirected off-domain")

            if response.status_code >= 400:
                return None

            content_type = response.headers.get("content-type", "").lower()
            if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
                raise ValueError(f"{page_url}: unsupported content type")

            content_length = response.headers.get("content-length")
            if content_length:
                try:
                    declared_size = int(content_length)
                except ValueError:
                    pass
                else:
                    if declared_size > MAX_RESPONSE_BYTES:
                        raise ValueError(f"{page_url}: response too large")

            chunks: list[bytes] = []
            total_bytes = 0
            for chunk in response.iter_bytes():
                total_bytes += len(chunk)
                if total_bytes > MAX_RESPONSE_BYTES:
                    raise ValueError(f"{page_url}: response too large")
                chunks.append(chunk)

        html = b"".join(chunks).decode("utf-8", errors="ignore")
        title, text = self._extract_text(html)
        if not text:
            return None

        excerpt = text[:MAX_EXCERPT_CHARS].strip()
        return _FetchedPage(
            page=CompanyPage(
                url=str(response.url),
                path=path,
                status_code=response.status_code,
                title=title,
                text_excerpt=excerpt,
                text_length=len(text),
            ),
            text=text,
        )

    def _extract_text(self, html: str) -> tuple[str | None, str]:
        parser = _HtmlTextExtractor()
        try:
            parser.feed(html)
            parser.close()
        except Exception:
            pass

        raw_text = " ".join(parser.parts)
        raw_text = unescape(raw_text)
        raw_text = re.sub(r"\s+", " ", raw_text).strip()
        text = raw_text[:MAX_PAGE_TEXT_CHARS].strip()
        title = " ".join(parser.title_parts).strip() or None
        title = unescape(title) if title else None
        return title, text


_company_collection_service = CompanyCollectionService()


def get_company_collection_service() -> CompanyCollectionService:
    return _company_collection_service
