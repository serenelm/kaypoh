import json
import re
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import optional_user
from app.db import get_db
from app.models.claim import Claim
from app.models.factcheck import FactCheckRequest, FactCheckResult
from app.models.submission import Submission
from app.services.factcheck import run_fact_check

router = APIRouter(prefix="/api/fact-check", tags=["fact-check"])

STOP_WORDS = frozenset([
    "this", "that", "with", "from", "have", "been", "will", "they", "their",
    "about", "which", "what", "when", "where", "there", "these", "those",
    "were", "your", "more", "also", "into", "than", "some", "such", "like",
    "just", "then", "over", "even", "back", "only", "very", "after", "well",
    "here", "both", "each", "much", "make", "most", "know", "does", "said",
    "says", "singapore", "the", "and", "for", "not", "but", "has", "had",
    "its", "are", "was", "can", "all", "new", "one", "two", "three",
])


def extract_keywords(text: str, max_kw: int = 8) -> list[str]:
    words = re.findall(r"\b[a-z]+\b", text.lower())
    seen: set[str] = set()
    out: list[str] = []
    for w in words:
        if len(w) > 3 and w not in STOP_WORDS and w not in seen:
            seen.add(w)
            out.append(w)
            if len(out) >= max_kw:
                break
    return out


def topic_key(keywords: list[str]) -> str:
    return "_".join(sorted(keywords[:3]))


def find_similar_claims(
    keywords: list[str], submission_id: int, db: Session
) -> tuple[int, Optional[str]]:
    """Return (count, topic_display) of submissions with 3+ matching keywords."""
    kw_set = set(keywords)
    if len(kw_set) < 3:
        return 0, None

    recent = (
        db.query(Claim)
        .filter(Claim.submission_id != submission_id)
        .order_by(Claim.created_at.desc())
        .limit(200)
        .all()
    )
    matched_ids: set[int] = set()
    for claim in recent:
        try:
            existing_kws = set(json.loads(claim.keywords))
        except Exception:
            continue
        if len(kw_set & existing_kws) >= 3:
            matched_ids.add(claim.submission_id)

    if not matched_ids:
        return 0, None

    topic = " ".join(list(keywords[:3]))
    return len(matched_ids), topic


@router.post("", response_model=FactCheckResult)
async def fact_check(
    request: FactCheckRequest,
    db: Session = Depends(get_db),
    user: Optional[dict] = Depends(optional_user),
) -> FactCheckResult:
    try:
        result = await run_fact_check(request)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to fetch URL ({e.response.status_code}): {e.request.url}",
        )
    except httpx.RequestError as e:
        raise HTTPException(status_code=422, detail=f"Could not reach URL: {e.request.url}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    user_identifier = user["sub"] if user else None

    sub = Submission(
        user_identifier=user_identifier,
        input_type="url" if request.url else "text",
        input_value=str(request.url) if request.url else request.text,
        verdict=result.verdict,
        confidence=result.confidence,
        harm_category=result.harm_category,
        harm_severity=result.harm_severity,
        platform_likelihood=json.dumps(result.platform_likelihood),
        demographic_vulnerability=json.dumps(result.demographic_vulnerability),
        multilingual_summaries=json.dumps(result.multilingual_summaries),
        result_json=result.model_dump_json(),
    )
    db.add(sub)
    db.flush()  # get sub.id before commit

    # Claim clustering (text submissions only)
    similar_count = 0
    similar_topic: Optional[str] = None
    if request.text:
        keywords = extract_keywords(request.text)
        if keywords:
            similar_count, similar_topic = find_similar_claims(keywords, sub.id, db)
            db.add(Claim(
                submission_id=sub.id,
                keywords=json.dumps(keywords),
                topic_key=topic_key(keywords),
            ))

    db.commit()

    return FactCheckResult(
        **result.model_dump(),
        submission_id=sub.id,
        similar_claims_count=similar_count,
        similar_claims_topic=similar_topic,
    )
