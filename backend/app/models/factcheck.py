from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, HttpUrl, model_validator


class PlatformLikelihood(BaseModel):
    whatsapp: int
    tiktok: int
    facebook: int


class MultilingualSummaries(BaseModel):
    en: str
    zh: str
    ms: str
    ta: str


class FactCheckRequest(BaseModel):
    text: str | None = None
    url: HttpUrl | None = None

    @model_validator(mode="after")
    def check_text_or_url(self) -> FactCheckRequest:
        if not self.text and not self.url:
            raise ValueError("Either 'text' or 'url' must be provided")
        if self.text and self.url:
            raise ValueError("Provide either 'text' or 'url', not both")
        return self


class FactCheckResponse(BaseModel):
    verdict: Literal["accurate", "misleading", "unverified"]
    confidence: Literal["high", "medium", "low"]
    explanation: str
    claims: list[str]
    sources: list[str]
    platform_likelihood: PlatformLikelihood
    harm_severity: Literal["low", "medium", "high", "critical"]
    harm_category: Literal[
        "health", "financial", "racial", "political", "government_impersonation"
    ]
    consequence_mapping: str
    multilingual_summaries: MultilingualSummaries
    demographic_vulnerability: list[str]


class FactCheckResult(FactCheckResponse):
    """HTTP response — extends FactCheckResponse with server-side metadata."""
    submission_id: int
    similar_claims_count: int = 0
    similar_claims_topic: str | None = None
