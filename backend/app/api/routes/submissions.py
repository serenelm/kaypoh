import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, optional_user
from app.db import get_db
from app.models.submission import Submission
from app.models.vote import Vote

router = APIRouter(prefix="/api/submission", tags=["submissions"])


# ─── Vote ───────────────────────────────────────────────────────────────────

class VoteRequest(BaseModel):
    vote: Literal["agree", "disagree"]


@router.post("/{submission_id}/vote")
def cast_vote(
    submission_id: int,
    body: VoteRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_identifier = user["sub"]
    if not db.query(Submission.id).filter(Submission.id == submission_id).scalar():
        raise HTTPException(status_code=404, detail="Submission not found")

    existing = (
        db.query(Vote)
        .filter(Vote.submission_id == submission_id, Vote.user_identifier == user_identifier)
        .first()
    )
    if existing:
        existing.vote = body.vote
    else:
        db.add(Vote(submission_id=submission_id, user_identifier=user_identifier, vote=body.vote))
    db.commit()
    return _vote_tally(submission_id, db)


@router.get("/{submission_id}/votes")
def get_votes(submission_id: int, db: Session = Depends(get_db)):
    return _vote_tally(submission_id, db)


def _vote_tally(submission_id: int, db: Session) -> dict:
    rows = db.query(Vote.vote, func.count(Vote.id)).filter(
        Vote.submission_id == submission_id
    ).group_by(Vote.vote).all()
    tally = {v: c for v, c in rows}
    agree = tally.get("agree", 0)
    disagree = tally.get("disagree", 0)
    return {
        "agree": agree,
        "disagree": disagree,
        "is_disputed": (disagree - agree) >= 3,
    }


# ─── Platform tag ────────────────────────────────────────────────────────────

class PlatformRequest(BaseModel):
    platform: Literal["whatsapp", "tiktok", "facebook", "instagram", "other"]


@router.patch("/{submission_id}/platform")
def tag_platform(
    submission_id: int,
    body: PlatformRequest,
    db: Session = Depends(get_db),
    user: Optional[dict] = Depends(optional_user),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.platform_tag = body.platform
    db.commit()
    return {"ok": True, "platform": body.platform}


# ─── Platform spread ────────────────────────────────────────────────────────

@router.get("/{submission_id}/platform-spread")
def platform_spread(submission_id: int, db: Session = Depends(get_db)):
    """Return platform tag counts across all submissions with the same input_value."""
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    rows = (
        db.query(Submission.platform_tag, func.count(Submission.id).label("cnt"))
        .filter(
            Submission.input_value == sub.input_value,
            Submission.platform_tag.isnot(None),
        )
        .group_by(Submission.platform_tag)
        .all()
    )
    counts = {platform: cnt for platform, cnt in rows}
    # Find the platform with 3+ reports (most common first)
    viral = {p: c for p, c in counts.items() if c >= 3}
    top_platform = max(viral, key=viral.get) if viral else None
    return {
        "counts": counts,
        "viral_platform": top_platform,
        "viral_count": viral.get(top_platform, 0) if top_platform else 0,
    }


# ─── History ─────────────────────────────────────────────────────────────────

@router.get("/history")
def history(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_identifier = user["sub"]
    rows = (
        db.query(Submission)
        .filter(Submission.user_identifier == user_identifier)
        .order_by(Submission.created_at.desc())
        .limit(100)
        .all()
    )
    result = []
    for r in rows:
        entry = {
            "id": r.id,
            "input_type": r.input_type,
            "input_value": r.input_value[:80],
            "verdict": r.verdict,
            "harm_category": r.harm_category,
            "harm_severity": r.harm_severity,
            "platform_tag": r.platform_tag,
            "created_at": r.created_at.isoformat(),
            "result_json": None,
        }
        if r.result_json:
            try:
                entry["result_json"] = json.loads(r.result_json)
            except Exception:
                pass
        result.append(entry)
    return result
