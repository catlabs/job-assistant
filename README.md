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

- Python 3.11+ recommended
- Node.js 20+ recommended for the frontend build
- CI currently validates the repo with Node.js 20 and Python 3.12

## Local development

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

Frontend quick start:

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

## First deployment guide

This project deploys as two separate pieces:

- `frontend/` builds into static files under `frontend/dist/`
- `backend/` runs as an ASGI app with entrypoint `app.main:app`
- The backend host must keep both the SQLite file and the repo-root `user_profile.json` on persistent storage if you want those features to survive restarts/redeploys

### 1. Deploy the backend

Copy the repository to the target host, keeping the repo root and `backend/` directory together. Then from `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Update `backend/.env` for the target environment:

- `JOB_ASSISTANT_DEBUG=false`
- `JOB_ASSISTANT_DATABASE_URL` should use a persistent absolute path in production, for example `sqlite:////var/lib/job-assistant/job_assistant.db`
- `JOB_ASSISTANT_CORS_ALLOW_ORIGINS` must include the deployed frontend origin exactly, for example `https://jobs.example.com`
- `JOB_ASSISTANT_API_KEY` is optional but recommended if the backend is reachable from the internet
- `JOB_ASSISTANT_OPENAI_API_KEY` is required for LLM-backed features such as `/jobs/extract-fields` and profile explanation
- `JOB_ASSISTANT_HOST` can stay `127.0.0.1` if a same-host reverse proxy forwards traffic to it; use `0.0.0.0` if the app must listen on a non-local interface directly

Run the backend from `backend/` with either of these:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```bash
python -m app.main
```

`python -m app.main` reads `JOB_ASSISTANT_HOST`, `JOB_ASSISTANT_PORT`, and `JOB_ASSISTANT_DEBUG` from `backend/.env`. `uvicorn app.main:app` is the clearer production-style entrypoint when you want explicit startup arguments.

### 2. Deploy the frontend

From `frontend/`:

```bash
cp .env.example .env
npm ci
npm run build
```

Before building, set:

- `VITE_API_BASE_URL` to the public backend URL that the browser should call
- `VITE_API_KEY` only if you enabled backend protected mode and want the frontend to send the shared key automatically

Deploy the generated `frontend/dist/` directory to any static host or web server. The frontend is a static Vite build; there is no frontend runtime server requirement beyond serving those files.

Important frontend behavior:

- `VITE_*` values are baked into the bundle at build time
- changing `VITE_API_BASE_URL` or `VITE_API_KEY` requires a new frontend build
- `VITE_API_KEY` is visible to the browser and should be treated only as a light demo gate, not as a secret

### 3. Production-minded checklist

- turn debug off
- use an explicit persistent SQLite file path
- use a persistent writable location for the repo-root `user_profile.json`
- set CORS to the real frontend origin instead of localhost defaults
- decide whether the backend will be local-only behind a reverse proxy or directly reachable on the network
- set `JOB_ASSISTANT_API_KEY` if the backend is internet-exposed and you want protected routes gated

## Configuration

Environment variables use the prefix `JOB_ASSISTANT_` (see `backend/app/core/config.py`). The backend loads its `.env` file from `backend/.env`.

- **`JOB_ASSISTANT_DATABASE_URL`** — default `sqlite:///./job_assistant.db`; use an absolute persistent path in production rather than relying on the current working directory
- **`JOB_ASSISTANT_API_KEY`** — optional shared secret for protected mode; when set, protected routes accept either `Authorization: Bearer <token>` or `X-API-Key: <token>`
- **`JOB_ASSISTANT_CORS_ALLOW_ORIGINS`** — comma-separated CORS origin list; set this to the real deployed frontend origin(s) in production
- **`JOB_ASSISTANT_OPENAI_API_KEY`** — required for LLM-backed features such as `POST /jobs/extract-fields`
- **`JOB_ASSISTANT_OPENAI_MODEL`** — extraction model (default `gpt-4.1-mini`)
- **`JOB_ASSISTANT_OPENAI_TIMEOUT_SECONDS`** — OpenAI timeout (default `20`)
- **`JOB_ASSISTANT_DEBUG`** — keep this `false` in production
- **`JOB_ASSISTANT_HOST` / `JOB_ASSISTANT_PORT`** — used by `python -m app.main`; production values depend on whether you bind directly or only behind a local reverse proxy

Protected mode is intentionally simple:

- If `JOB_ASSISTANT_API_KEY` is unset, local development stays unprotected.
- If `JOB_ASSISTANT_API_KEY` is set, the backend protects expensive or sensitive routes and the frontend should send the same value through `VITE_API_KEY`.
- `VITE_API_KEY` is not a real secret because it is embedded in the browser bundle.
- For production, set both the backend API key and an explicit frontend origin list instead of relying on the localhost defaults.

Do **not** commit `.env` or your local `.db` if they contain personal data.
Do **not** commit your local `user_profile.json`; use `user_profile.example.json` as a starting template.

`/profile` currently maps to a single local `user_profile.json` on the backend host.
That file is stored outside `backend/`, at the repository root next to `backend/`.
For a manual deployment, make sure that location stays writable and persistent across restarts/redeploys.
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

Read-only routes such as health checks, job reads, and profile reads remain unauthenticated even when protected mode is enabled.

## Current limitations

- SQLite is appropriate for a single-host first deployment, but not for multi-instance writes, shared network filesystems, or high-concurrency production traffic.
- `user_profile.json` is a single file on the backend host and assumes the current repository layout; deploying only `backend/` without the repo root will break that persistence expectation.
- `JOB_ASSISTANT_API_KEY` protects selected routes only; it is not a full user authentication system.
- `VITE_API_KEY` is visible in the browser bundle and should not be treated as a secret.
- There is no automated deployment, managed secrets workflow, backup policy, or database migration pipeline yet.

## Roadmap (informal)

- Richer analysis via an LLM, with secrets in `.env`
- Optional migrations (e.g. Alembic) when the schema stabilizes
- Frontend or CLI client as needed

## License

Private / personal use unless you add a license file.
