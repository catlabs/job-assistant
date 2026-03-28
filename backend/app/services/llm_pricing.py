TokenRate = tuple[float, float]

_MODEL_TOKEN_RATES_PER_MILLION: dict[str, TokenRate] = {
    "gpt-4.1": (2.0, 8.0),
    "gpt-4.1-mini": (0.4, 1.6),
    "gpt-4.1-nano": (0.1, 0.4),
}


def _get_rate_for_model(model: str | None) -> TokenRate | None:
    if not model:
        return None

    normalized = model.strip().lower()
    if not normalized:
        return None

    exact = _MODEL_TOKEN_RATES_PER_MILLION.get(normalized)
    if exact is not None:
        return exact

    for prefix, rate in _MODEL_TOKEN_RATES_PER_MILLION.items():
        if normalized.startswith(prefix):
            return rate

    return None


def estimate_token_cost_usd(
    *,
    model: str | None,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    total_tokens: int | None,
) -> float | None:
    rate = _get_rate_for_model(model)
    if rate is None:
        return None

    input_rate, output_rate = rate
    prompt = prompt_tokens if isinstance(prompt_tokens, int) and prompt_tokens >= 0 else None
    completion = (
        completion_tokens if isinstance(completion_tokens, int) and completion_tokens >= 0 else None
    )
    total = total_tokens if isinstance(total_tokens, int) and total_tokens >= 0 else None

    if prompt is not None and completion is not None:
        return round((prompt * input_rate + completion * output_rate) / 1_000_000, 8)

    if total is not None:
        # Fallback when only total is available: apply input rate conservatively.
        return round((total * input_rate) / 1_000_000, 8)

    return None
