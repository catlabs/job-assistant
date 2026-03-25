from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import DeclarativeBase, mapped_column


class Base(DeclarativeBase):
    pass


class JobRecord(Base):
    """Persist raw job fields plus an analysis snapshot.

    SQLite dev note: create_all() will not add this column to an existing
    jobs table; deleting backend/job_assistant.db is acceptable locally.
    """

    __tablename__ = "jobs"

    id = mapped_column(String(36), primary_key=True)
    title = mapped_column(String(255), nullable=True)
    company = mapped_column(String(255), nullable=True)
    location = mapped_column(String(255), nullable=True)
    url = mapped_column(String(2048), nullable=True)
    source = mapped_column(String(100), nullable=False)
    description = mapped_column(Text, nullable=False)
    analysis_json = mapped_column(Text, nullable=False)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, index=True)
