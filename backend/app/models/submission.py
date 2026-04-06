from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    input_type: Mapped[str] = mapped_column(String(4), nullable=False)   # "text" | "url"
    input_value: Mapped[str] = mapped_column(Text, nullable=False)
    verdict: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[str] = mapped_column(String(10), nullable=False)
    harm_category: Mapped[str] = mapped_column(String(50), nullable=False)
    harm_severity: Mapped[str] = mapped_column(String(10), nullable=False)
    platform_likelihood: Mapped[str] = mapped_column(Text, nullable=False)       # JSON
    demographic_vulnerability: Mapped[str] = mapped_column(Text, nullable=False)
    multilingual_summaries: Mapped[str] = mapped_column(Text, nullable=False)    # JSON
