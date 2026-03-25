# Job Intelligence Assistant

Personal project: a small **FastAPI** backend to collect job postings, run **lightweight analysis** (heuristics today, LLM later), persist data in **SQLite**, and expose a simple **REST API** plus a placeholder **ask** endpoint.

## Features

- **Health** check for monitoring and local sanity checks
- **Jobs**: create listings, list all, fetch by id — analysis is computed once on create and stored with the row
- **Job extraction**: stateless LLM extraction from pasted posting text (`POST /jobs/extract-fields`), no persistence
- **Ask**: stub Q&A over stored jobs (optional use of `user_profile.json` at the repo root)
- **SQLite** persistence via **SQLAlchemy** (no auth, minimal surface area)

## Stack

- Python 3
- FastAPI, Uvicorn
- Pydantic / pydantic-settings
- SQLAlchemy 2.x + SQLite

## Project layout

```text
backend/
  app/
    main.py              # FastAPI app + lifespan (DB init)
    api/routers/         # health, jobs, ask
    schemas/             # Pydantic request/response models
    services/            # job storage, analysis, ask stub, profile loader
    core/config.py       # settings from environment
    db/                  # SQLAlchemy models + session
  requirements.txt
user_profile.json        # optional context for /ask (not required for /jobs)
```

## Prerequisites

- Python 3.11+ recommended (3.14 works with the pinned dependencies in this repo)

## Quick start

From the repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env        # edit values if needed
```

Run the API (from `backend/`):

```bash
python -m app.main
```

Or:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open **interactive docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Configuration

Environment variables use the prefix `JOB_ASSISTANT_` (see `backend/app/core/config.py`). Copy `backend/.env.example` to `backend/.env` and adjust.

- **`JOB_ASSISTANT_DATABASE_URL`** — default `sqlite:///./job_assistant.db` (file is created next to your current working directory when using a relative path; running from `backend/` keeps the DB under `backend/`).
- **`JOB_ASSISTANT_OPENAI_API_KEY`** — required for `POST /jobs/extract-fields`
- **`JOB_ASSISTANT_OPENAI_MODEL`** — extraction model (default `gpt-4.1-mini`)
- **`JOB_ASSISTANT_OPENAI_TIMEOUT_SECONDS`** — OpenAI timeout (default `20`)

Do **not** commit `.env` or your local `.db` if they contain personal data.

## API overview

| Method | Path        | Purpose        |
|--------|-------------|----------------|
| GET    | `/`         | Service metadata |
| GET    | `/health/`  | Liveness       |
| POST   | `/jobs/`    | Create job     |
| GET    | `/jobs/`    | List jobs      |
| POST   | `/jobs/extract-fields` | Stateless LLM field extraction |
| GET    | `/jobs/{id}`| Get one job    |
| POST   | `/ask/`     | Placeholder Q&A |

## Roadmap (informal)

- Richer analysis via an LLM, with secrets in `.env`
- Optional migrations (e.g. Alembic) when the schema stabilizes
- Frontend or CLI client as needed

## License

Private / personal use unless you add a license file.
