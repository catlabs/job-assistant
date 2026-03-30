# Job Intelligence Assistant

Personal project: a small **FastAPI** backend to collect job postings, run **lightweight analysis** (heuristics today, LLM later), persist data in **SQLite**, and expose a simple **REST API** plus a placeholder **ask** endpoint.

## Features

- **Health** check for monitoring and local sanity checks
- **Jobs**: create listings, list all, fetch by id — analysis is computed once on create and stored with the row
- **Job fit + decision analysis (optional)**: newly saved jobs may include AI-generated `fit_classification`, `fit_rationale`, and `decision` fields in `analysis_json` when `JOB_ASSISTANT_OPENAI_API_KEY` and `user_profile.json` are both configured
- **Profile page + API (V1)**: view/edit the local profile used by fit analysis (`/profile` in UI, `/profile/*` API)
- **Job extraction**: stateless LLM extraction from pasted posting text (`POST /jobs/extract-fields`), no persistence
- **Ask**: stub Q&A over stored jobs (optional use of `user_profile.json` at the repo root)
- **Optional shared-key protection**: protect expensive or sensitive backend routes with a single deploy-time API key
- **SQLite** persistence via **SQLAlchemy** (no auth, minimal surface area)

## Stack

- Python 3
- FastAPI, Uvicorn
- Pydantic / pydantic-settings
- SQLAlchemy 2.x + SQLite
- Frontend: Vite + React + TypeScript

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
user_profile.json        # local profile read/write target (not committed)
user_profile.example.json # template for creating your local profile
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

## Frontend quick start

From the repository root:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The Vite app runs at [http://localhost:5173](http://localhost:5173) and calls the backend using:

- `VITE_API_BASE_URL` (default in `.env.example`: `http://127.0.0.1:8000`)
- `VITE_API_KEY` (optional; only needed when backend protected mode is enabled)

Make sure the backend is running at the same base URL before clicking **Extract fields**.

## Configuration

Environment variables use the prefix `JOB_ASSISTANT_` (see `backend/app/core/config.py`). Copy `backend/.env.example` to `backend/.env` and adjust.

- **`JOB_ASSISTANT_DATABASE_URL`** — default `sqlite:///./job_assistant.db` (file is created next to your current working directory when using a relative path; running from `backend/` keeps the DB under `backend/`).
- **`JOB_ASSISTANT_API_KEY`** — optional shared secret for protected mode; when set, sensitive routes require either `Authorization: Bearer <token>` or `X-API-Key: <token>`
- **`JOB_ASSISTANT_CORS_ALLOW_ORIGINS`** — optional comma-separated CORS origin list; defaults to `http://localhost:5173,http://127.0.0.1:5173`
- **`JOB_ASSISTANT_OPENAI_API_KEY`** — required for `POST /jobs/extract-fields`
- **`JOB_ASSISTANT_OPENAI_MODEL`** — extraction model (default `gpt-4.1-mini`)
- **`JOB_ASSISTANT_OPENAI_TIMEOUT_SECONDS`** — OpenAI timeout (default `20`)

Protected mode is intentionally simple:

- If `JOB_ASSISTANT_API_KEY` is unset, local development stays unprotected.
- If `JOB_ASSISTANT_API_KEY` is set, the backend protects expensive or sensitive routes and the frontend should send the same value through `VITE_API_KEY`.
- For production, set both the backend API key and explicit frontend origin list instead of relying on the localhost defaults.

Do **not** commit `.env` or your local `.db` if they contain personal data.
Do **not** commit your local `user_profile.json`; use `user_profile.example.json` as a starting template.

`/profile` currently maps to a single local `user_profile.json` on the backend host.
A future multi-profile storage layer can keep the same API shape and swap the persistence implementation.

## API overview

| Method | Path        | Purpose        |
|--------|-------------|----------------|
| GET    | `/`         | Service metadata |
| GET    | `/health/`  | Liveness       |
| POST   | `/jobs/`    | Create job     |
| GET    | `/jobs/`    | List jobs      |
| POST   | `/jobs/extract-fields` | Stateless LLM field extraction, protected when API key is configured |
| GET    | `/jobs/{id}`| Get one job    |
| POST   | `/ask/`     | Placeholder Q&A |
| GET    | `/profile/` | Load current profile |
| PUT    | `/profile/` | Validate + save current profile, protected when API key is configured |
| POST   | `/profile/explain` | Optional one-shot AI profile explanation, protected when API key is configured |

Protected routes also include:

- `POST /jobs/`
- `POST /companies/ingest`
- `POST /companies/{id}/refresh`
- `GET /llm-logs/`

## Roadmap (informal)

- Richer analysis via an LLM, with secrets in `.env`
- Optional migrations (e.g. Alembic) when the schema stabilizes
- Frontend or CLI client as needed

## License

Private / personal use unless you add a license file.
