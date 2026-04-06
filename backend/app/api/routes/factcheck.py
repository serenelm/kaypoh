import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.factcheck import FactCheckRequest, FactCheckResponse
from app.models.submission import Submission
from app.services.factcheck import run_fact_check

router = APIRouter(prefix="/api/fact-check", tags=["fact-check"])


@router.post("", response_model=FactCheckResponse)
async def fact_check(
    request: FactCheckRequest, db: Session = Depends(get_db)
) -> FactCheckResponse:
    try:
        result = await run_fact_check(request)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to fetch URL ({e.response.status_code}): {e.request.url}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Could not reach URL: {e.request.url}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    db.add(
        Submission(
            input_type="url" if request.url else "text",
            input_value=str(request.url) if request.url else request.text,
            verdict=result.verdict,
            confidence=result.confidence,
            harm_category=result.harm_category,
            harm_severity=result.harm_severity,
            platform_likelihood=json.dumps(result.platform_likelihood.model_dump()),
            demographic_vulnerability=result.demographic_vulnerability,
            multilingual_summaries=json.dumps(result.multilingual_summaries.model_dump()),
        )
    )
    db.commit()

    return result
