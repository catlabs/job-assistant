import hashlib


def canonicalize_text_for_fingerprint(value: str) -> str:
    # Keep canonicalization minimal and explicit: trim ends and collapse whitespace runs.
    return " ".join(value.strip().split())


def fingerprint_text(value: str) -> str:
    canonical = canonicalize_text_for_fingerprint(value)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
