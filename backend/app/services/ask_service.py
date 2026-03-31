from app.schemas.ask import AskContext, AskRequest, AskResponse
from app.services.job_storage import InMemoryJobStorage, get_job_storage
from app.services.profile_loader import get_profile_summary, load_user_profile


class AskService:
    """Stub answer generator that can later be replaced by chat or LLM orchestration."""

    def __init__(self, storage: InMemoryJobStorage | None = None) -> None:
        self._storage = storage or get_job_storage()

    def answer(self, payload: AskRequest) -> AskResponse:
        jobs = self._storage.list_jobs()
        selected_job = self._storage.get_job(payload.job_id) if payload.job_id else None
        profile = load_user_profile() if payload.include_profile else {}
        profile_summary = get_profile_summary(profile)

        referenced_job_ids = [selected_job.id] if selected_job else []

        if selected_job:
            skills = [skill.name for skill in selected_job.criteria.technical_signals.skills] or ["none detected"]
            answer = (
                f"Stub answer for '{payload.question}'. "
                f"Using job '{selected_job.title or selected_job.id}' with "
                f"{selected_job.criteria.job_basics.seniority_level} seniority and skills "
                f"{skills}."
            )
        elif jobs:
            answer = (
                f"Stub answer for '{payload.question}'. "
                f"I currently have {len(jobs)} stored job(s) available for future comparison."
            )
        else:
            answer = (
                f"Stub answer for '{payload.question}'. "
                "No jobs are stored yet, so this response is based on placeholder logic only."
            )

        if profile_summary:
            answer = f"{answer} Profile context loaded: {profile_summary}"

        return AskResponse(
            question=payload.question,
            answer=answer,
            context=AskContext(
                total_jobs=len(jobs),
                referenced_job_ids=referenced_job_ids,
                profile_loaded=bool(profile_summary),
            ),
            follow_up_suggestions=[
                "Ask for a criteria summary for a specific job.",
                "Ask which required skills a job mentions.",
                "Ask for a shortlist once more jobs are stored.",
            ],
        )


_ask_service = AskService()


def get_ask_service() -> AskService:
    return _ask_service
