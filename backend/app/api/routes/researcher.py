import json
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.claim import Claim
from app.models.submission import Submission
from app.models.vote import Vote

router = APIRouter(prefix="/api/researcher", tags=["researcher"])

HARM_CATEGORIES = ["health", "financial", "racial", "political", "government_impersonation"]
PLATFORMS = ["whatsapp", "tiktok", "facebook", "instagram"]


def _require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


@router.get("/overview")
def researcher_overview(
    db: Session = Depends(get_db),
    user: dict = Depends(_require_admin),
):
    now = datetime.now(tz=timezone.utc)
    this_week = now - timedelta(days=7)
    last_week = now - timedelta(days=14)

    # ── Misinformation heatmap (harm categories this week vs last week) ────────
    def _cat_counts(since, until):
        rows = (
            db.query(Submission.harm_category, func.count(Submission.id).label("cnt"))
            .filter(Submission.created_at >= since, Submission.created_at < until)
            .group_by(Submission.harm_category)
            .all()
        )
        return {cat: cnt for cat, cnt in rows}

    heatmap = {
        "this_week": _cat_counts(this_week, now),
        "last_week": _cat_counts(last_week, this_week),
    }

    # ── Disputed verdicts ────────────────────────────────────────────────────
    vote_agg = (
        db.query(Vote.submission_id, Vote.vote, func.count(Vote.id).label("cnt"))
        .group_by(Vote.submission_id, Vote.vote)
        .all()
    )
    tally: dict[int, dict] = {}
    for sid, vote, cnt in vote_agg:
        tally.setdefault(sid, {"agree": 0, "disagree": 0})
        tally[sid][vote] = cnt

    disputed_ids = [
        sid for sid, t in tally.items() if (t["disagree"] - t["agree"]) >= 3
    ]

    disputed = []
    for sid in disputed_ids[:10]:
        sub = db.query(Submission).filter(Submission.id == sid).first()
        if sub:
            t = tally[sid]
            disputed.append({
                "submission_id": sid,
                "input_value": sub.input_value[:100],
                "verdict": sub.verdict,
                "agree": t["agree"],
                "disagree": t["disagree"],
            })

    # ── Platform spread accuracy ──────────────────────────────────────────────
    # Compare AI predicted likelihood vs actual user-reported tags
    subs_with_pl = (
        db.query(Submission)
        .filter(Submission.platform_likelihood.isnot(None))
        .order_by(Submission.created_at.desc())
        .limit(200)
        .all()
    )

    ai_totals = {p: 0 for p in PLATFORMS}
    ai_counts = {p: 0 for p in PLATFORMS}
    user_tag_counts = Counter()
    total_tagged = 0

    for s in subs_with_pl:
        try:
            pl = json.loads(s.platform_likelihood)
            for p in PLATFORMS:
                if p in pl:
                    ai_totals[p] += pl[p]
                    ai_counts[p] += 1
        except Exception:
            pass
        if s.platform_tag:
            user_tag_counts[s.platform_tag] += 1
            total_tagged += 1

    platform_accuracy = []
    for p in PLATFORMS:
        ai_avg = round(ai_totals[p] / ai_counts[p]) if ai_counts[p] else 0
        user_pct = round((user_tag_counts[p] / total_tagged) * 100) if total_tagged else 0
        platform_accuracy.append({
            "platform": p,
            "ai_predicted_pct": ai_avg,
            "user_reported_pct": user_pct,
            "user_reported_count": user_tag_counts[p],
        })

    # ── Claim clustering ──────────────────────────────────────────────────────
    cluster_rows = (
        db.query(Claim.topic_key, func.count(Claim.id).label("cnt"))
        .filter(Claim.created_at >= this_week)
        .group_by(Claim.topic_key)
        .order_by(func.count(Claim.id).desc())
        .limit(5)
        .all()
    )

    claim_clusters = []
    for topic_key, cnt in cluster_rows:
        # Aggregate verdicts for submissions in this cluster
        subs = (
            db.query(Submission.verdict)
            .join(Claim, Claim.submission_id == Submission.id)
            .filter(Claim.topic_key == topic_key, Claim.created_at >= this_week)
            .all()
        )
        verdicts = Counter(s.verdict for s in subs)
        claim_clusters.append({
            "topic": topic_key.replace("_", " "),
            "count": cnt,
            "verdicts": dict(verdicts),
        })

    # ── Demographic vulnerability index ───────────────────────────────────────
    demo_counter: Counter = Counter()
    demo_rows = (
        db.query(Submission.demographic_vulnerability)
        .filter(
            Submission.created_at >= this_week,
            Submission.demographic_vulnerability.isnot(None),
        )
        .all()
    )
    for (dv,) in demo_rows:
        try:
            groups = json.loads(dv)
            if isinstance(groups, list):
                for g in groups:
                    demo_counter[g] += 1
        except Exception:
            pass
    demographic_index = [
        {"group": g, "count": c}
        for g, c in demo_counter.most_common(8)
    ]

    # ── Trend comparison ──────────────────────────────────────────────────────
    def _misleading_rate(since, until):
        total = db.query(func.count(Submission.id)).filter(
            Submission.created_at >= since, Submission.created_at < until
        ).scalar() or 0
        misleading = db.query(func.count(Submission.id)).filter(
            Submission.created_at >= since,
            Submission.created_at < until,
            Submission.verdict == "misleading",
        ).scalar() or 0
        return round((misleading / total) * 100) if total else 0

    this_week_rate = _misleading_rate(this_week, now)
    last_week_rate = _misleading_rate(last_week, this_week)
    trend = {
        "this_week_pct": this_week_rate,
        "last_week_pct": last_week_rate,
        "change": this_week_rate - last_week_rate,
    }

    # ── Full recent submissions feed (logged-in users only) ──────────────────
    recent_rows = (
        db.query(Submission)
        .filter(
            Submission.user_identifier.isnot(None),
            Submission.user_identifier != "",
            Submission.user_identifier != "anonymous",
        )
        .order_by(Submission.created_at.desc())
        .limit(20)
        .all()
    )
    recent_submissions = [
        {
            "id": r.id,
            "input_type": r.input_type,
            "input_value": r.input_value[:120],
            "verdict": r.verdict,
            "confidence": r.confidence,
            "harm_category": r.harm_category,
            "harm_severity": r.harm_severity,
            "platform_tag": r.platform_tag,
            "user_identifier": r.user_identifier,
            "created_at": r.created_at.isoformat(),
        }
        for r in recent_rows
    ]

    return {
        "heatmap": heatmap,
        "disputed": disputed,
        "platform_accuracy": platform_accuracy,
        "claim_clusters": claim_clusters,
        "demographic_index": demographic_index,
        "trend": trend,
        "recent_submissions": recent_submissions,
    }
