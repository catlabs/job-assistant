from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Base

settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def create_db_and_tables() -> None:
    _reset_sqlite_jobs_table_if_legacy()
    Base.metadata.create_all(bind=engine)


def _reset_sqlite_jobs_table_if_legacy() -> None:
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "jobs" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("jobs")}
    expected_columns = {
        "id",
        "title",
        "company",
        "location",
        "url",
        "source",
        "description",
        "criteria_json",
        "created_at",
    }
    has_legacy_shape = "analysis_json" in columns or "company_id" in columns
    missing_required_columns = not expected_columns.issubset(columns)

    if not has_legacy_shape and not missing_required_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("DROP TABLE jobs"))


@contextmanager
def get_db_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
