import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.claim import Claim
from app.models.submission import Submission
from app.models.vote import Vote

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    total: int = db.query(func.count(Submission.id)).scalar() or 0

    verdict_distribution = dict(
        db.query(Submission.verdict, func.count(Submission.id))
        .group_by(Submission.verdict).all()
    )

    harm_category_breakdown = dict(
        db.query(Submission.harm_category, func.count(Submission.id))
        .group_by(Submission.harm_category).all()
    )

    harm_severity_breakdown = dict(
        db.query(Submission.harm_severity, func.count(Submission.id))
        .group_by(Submission.harm_severity).all()
    )

    # Crowdsourced platform tags (user-reported)
    platform_tag_rows = (
        db.query(Submission.platform_tag, func.count(Submission.id))
        .filter(Submission.platform_tag.isnot(None))
        .group_by(Submission.platform_tag).all()
    )
    crowdsourced_platforms = dict(platform_tag_rows)

    # Trending domains from URL submissions
    url_rows = db.query(Submission.input_value).filter(Submission.input_type == "url").all()
    domain_counts: Counter = Counter()
    for (url,) in url_rows:
        host = urlparse(url).hostname or ""
        host = host.removeprefix("www.")
        if host:
            domain_counts[host] += 1

    # Disputed submissions (disagree - agree >= 3)
    vote_agg = (
        db.query(Vote.submission_id, Vote.vote, func.count(Vote.id).label("cnt"))
        .group_by(Vote.submission_id, Vote.vote).all()
    )
    tally: dict[int, dict] = {}
    for sid, vote, cnt in vote_agg:
        tally.setdefault(sid, {"agree": 0, "disagree": 0})
        tally[sid][vote] = cnt
    disputed_ids = [
        sid for sid, t in tally.items() if (t["disagree"] - t["agree"]) >= 3
    ]

    return {
        "total_submissions": total,
        "verdict_distribution": verdict_distribution,
        "harm_category_breakdown": harm_category_breakdown,
        "harm_severity_breakdown": harm_severity_breakdown,
        "trending_domains": [
            {"domain": d, "count": c} for d, c in domain_counts.most_common(10)
        ],
        "crowdsourced_platforms": crowdsourced_platforms,
        "disputed_count": len(disputed_ids),
    }


@router.get("/recent")
def recent_submissions(db: Session = Depends(get_db)):
    rows = (
        db.query(Submission)
        .order_by(Submission.created_at.desc())
        .limit(10).all()
    )
    return [
        {
            "id": r.id,
            "input_type": r.input_type,
            "input_value": r.input_value[:80],
            "verdict": r.verdict,
            "harm_category": r.harm_category,
            "platform_tag": r.platform_tag,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/trending-claims")
def trending_claims(db: Session = Depends(get_db)):
    since = datetime.now(tz=timezone.utc) - timedelta(days=7)

    rows = (
        db.query(Claim.topic_key, func.count(Claim.id).label("cnt"))
        .filter(Claim.created_at >= since)
        .group_by(Claim.topic_key)
        .order_by(func.count(Claim.id).desc())
        .limit(5).all()
    )

    result = []
    for topic_key, cnt in rows:
        # Get the most recent verdict for this topic
        latest_claim = (
            db.query(Claim)
            .filter(Claim.topic_key == topic_key)
            .order_by(Claim.created_at.desc())
            .first()
        )
        verdict = None
        if latest_claim:
            sub = db.query(Submission).filter(
                Submission.id == latest_claim.submission_id
            ).first()
            if sub:
                verdict = sub.verdict

        topic_display = topic_key.replace("_", " ")
        result.append({
            "topic": topic_display,
            "count": cnt,
            "verdict": verdict,
        })
    return result
