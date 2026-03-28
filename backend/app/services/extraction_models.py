from app.core.config import get_settings

# Curated model IDs for extraction parse calls.
EXTRACTION_MODEL_ALLOWLIST: tuple[str, ...] = (
    "gpt-4.1-mini",
    "gpt-4.1",
)


def get_allowed_extraction_models() -> list[str]:
    settings = get_settings()
    models: list[str] = list(EXTRACTION_MODEL_ALLOWLIST)
    if settings.openai_model not in models:
        models.insert(0, settings.openai_model)
    return models
