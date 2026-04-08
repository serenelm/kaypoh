import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.claim import Claim
from app.models.submission import Submission
from app.models.vote import Vote

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/stats")
def user_stats(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    uid = user["sub"]
    now = datetime.now(tz=timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    # ── Personal stats ────────────────────────────────────────────────────────

    my_submissions = (
        db.query(Submission)
        .filter(Submission.user_identifier == uid)
        .all()
    )
    total = len(my_submissions)
    verdict_breakdown = {"accurate": 0, "misleading": 0, "unverified": 0}
    for s in my_submissions:
        if s.verdict in verdict_breakdown:
            verdict_breakdown[s.verdict] += 1

    my_sub_ids = {s.id for s in my_submissions}

    # Votes cast by this user
    votes_cast = db.query(func.count(Vote.id)).filter(
        Vote.user_identifier == uid
    ).scalar() or 0

    # Platform tags on their own submissions
    platform_tags = sum(1 for s in my_submissions if s.platform_tag is not None)

    contribution_score = votes_cast + platform_tags

    # Last 5 submissions
    recent = sorted(my_submissions, key=lambda s: s.created_at, reverse=True)[:5]
    recent_checks = [
        {
            "id": r.id,
            "input_type": r.input_type,
            "input_value": r.input_value[:80],
            "verdict": r.verdict,
            "harm_category": r.harm_category,
            "created_at": r.created_at.isoformat(),
        }
        for r in recent
    ]

    # ── Community / Singapore insights ───────────────────────────────────────

    # Top 3 harm categories this week (all users)
    cat_rows = (
        db.query(Submission.harm_category, func.count(Submission.id).label("cnt"))
        .filter(Submission.created_at >= week_start)
        .group_by(Submission.harm_category)
        .order_by(func.count(Submission.id).desc())
        .limit(3)
        .all()
    )
    week_in_singapore = [
        {"category": cat.replace("_", " "), "count": cnt}
        for cat, cnt in cat_rows
    ]

    # Most checked claim topics from keyword clusters (text submissions this week)
    topic_rows = (
        db.query(Claim.topic_key, func.count(Claim.id).label("cnt"))
        .filter(Claim.created_at >= week_start)
        .group_by(Claim.topic_key)
        .order_by(func.count(Claim.id).desc())
        .limit(5)
        .all()
    )
    most_checked_topics = [
        {"topic": tk.replace("_", " "), "count": cnt}
        for tk, cnt in topic_rows
    ]

    # Community activity counts
    checks_today = db.query(func.count(Submission.id)).filter(
        Submission.created_at >= today_start
    ).scalar() or 0

    votes_today = db.query(func.count(Vote.id)).filter(
        Vote.created_at >= today_start
    ).scalar() or 0

    tags_today = db.query(func.count(Submission.id)).filter(
        Submission.created_at >= today_start,
        Submission.platform_tag.isnot(None),
    ).scalar() or 0

    return {
        "total_submissions": total,
        "verdict_breakdown": verdict_breakdown,
        "contribution_score": contribution_score,
        "votes_cast": votes_cast,
        "platform_tags": platform_tags,
        "recent_checks": recent_checks,
        "week_in_singapore": week_in_singapore,
        "most_checked_topics": most_checked_topics,
        "community_activity": {
            "checks_today": checks_today,
            "votes_today": votes_today,
            "platform_tags_today": tags_today,
        },
    }
