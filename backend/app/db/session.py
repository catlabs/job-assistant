from contextlib import contextmanager
from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Base

settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def create_db_and_tables() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_jobs_table()


def _migrate_sqlite_jobs_table() -> None:
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "jobs" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("jobs")}
    with engine.begin() as connection:
        if "analysis_json" not in columns:
            connection.execute(text("ALTER TABLE jobs ADD COLUMN analysis_json TEXT"))
        if "company_id" not in columns:
            connection.execute(text("ALTER TABLE jobs ADD COLUMN company_id VARCHAR(36)"))


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
