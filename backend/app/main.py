from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Running `python app/main.py` puts `app/` on sys.path, not `backend/`, so `import app` fails.
# Ensure the backend package root is first on the path for direct script execution.
_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers.ask import router as ask_router
from app.api.routers.health import router as health_router
from app.api.routers.jobs import router as jobs_router
from app.api.routers.llm_logs import router as llm_logs_router
from app.api.routers.profile import router as profile_router
from app.core.config import get_settings
from app.db.session import create_db_and_tables


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.api_version,
        debug=settings.debug,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", tags=["root"])
    def read_root() -> dict[str, object]:
        return {
            "name": settings.app_name,
            "version": settings.api_version,
            "status": "ok",
        }

    app.include_router(health_router)
    app.include_router(jobs_router)
    app.include_router(ask_router)
    app.include_router(llm_logs_router)
    app.include_router(profile_router)

    return app


app = create_app()


def run() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    run()
