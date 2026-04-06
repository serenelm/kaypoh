from collections import Counter
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.submission import Submission

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    total: int = db.query(func.count(Submission.id)).scalar() or 0

    verdict_distribution = dict(
        db.query(Submission.verdict, func.count(Submission.id))
        .group_by(Submission.verdict)
        .all()
    )

    harm_category_breakdown = dict(
        db.query(Submission.harm_category, func.count(Submission.id))
        .group_by(Submission.harm_category)
        .all()
    )

    harm_severity_breakdown = dict(
        db.query(Submission.harm_severity, func.count(Submission.id))
        .group_by(Submission.harm_severity)
        .all()
    )

    # Extract and count domains from URL submissions only
    url_rows = (
        db.query(Submission.input_value)
        .filter(Submission.input_type == "url")
        .all()
    )
    domain_counts: Counter = Counter()
    for (url,) in url_rows:
        host = urlparse(url).hostname or ""
        host = host.removeprefix("www.")
        if host:
            domain_counts[host] += 1

    return {
        "total_submissions": total,
        "verdict_distribution": verdict_distribution,
        "harm_category_breakdown": harm_category_breakdown,
        "harm_severity_breakdown": harm_severity_breakdown,
        "trending_domains": [
            {"domain": d, "count": c} for d, c in domain_counts.most_common(10)
        ],
    }
