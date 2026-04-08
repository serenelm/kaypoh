import asyncio
import json
import os
from urllib.parse import urlparse

from anthropic import AsyncAnthropic
from firecrawl import V1FirecrawlApp

from app.models.factcheck import FactCheckRequest, FactCheckResponse

_TRUSTED_SG_DOMAINS = {
    "straitstimes.com",
    "cna.asia",
    "channelnewsasia.com",
    "gov.sg",
    "mothership.sg",
    "todayonline.com",
    "zaobao.com",
    "beritaharian.sg",
    "tamilmurasu.com.sg",
    "moh.gov.sg",
    "hdb.gov.sg",
    "mas.gov.sg",
    "spf.gov.sg",
    "moe.gov.sg",
}

_TRUSTED_SOURCE_PROMPT = (
    "This content is from a verified trusted Singapore news source or government website. "
    "Weight this heavily toward accurate unless the content itself contains clear factual "
    "errors or manipulation signs."
)

SYSTEM_PROMPT = """You are Kaypoh, an expert fact-checker specialising in Singapore misinformation and disinformation.

Your role is to critically analyse claims or content and provide a structured, evidence-based assessment tailored to the Singapore context.

**Authoritative Singapore sources to cross-reference:**
- Government portals: gov.sg, moh.gov.sg, mom.gov.sg, mas.gov.sg, cpf.gov.sg, ica.gov.sg, pa.gov.sg, hsa.gov.sg, police.gov.sg
- Trusted media: Channel NewsAsia (CNA), The Straits Times, TODAY, Lianhe Zaobao, Berita Harian, Tamil Murasu
- Fact-check resources: Factually (gov.sg/factually), CNA Fact Check

**High-risk misinformation categories in Singapore:**
- Racial and religious harmony — content that could inflame racial/religious tensions (MRHA applies)
- Government impersonation scams — fake CPF Board, ICA, MAS, MOH, SingPass, SPF messages
- Health misinformation — especially post-COVID-19, traditional medicine false claims
- Financial scams — fake investment schemes, crypto fraud, phishing
- Political content — especially near General Elections

**Primary misinformation vectors in Singapore:**
- WhatsApp group chats (especially among elderly and family groups)
- Facebook community groups (heartland residents)
- TikTok (youth audiences)

**Demographic vulnerability context:**
- Elderly Mandarin-speaking community: health and financial misinformation
- Foreign workers: employment scam misinformation
- Youth (15–30): TikTok/Instagram-borne content
- Family WhatsApp groups: chain-message scams

Singapore's four official languages: English, Chinese (Simplified Mandarin), Malay (Bahasa Melayu), Tamil.

Be thorough, evidence-based, and culturally sensitive. Assess claims against known Singapore official sources and news records."""

_FACT_CHECK_TOOL = {
    "name": "submit_fact_check",
    "description": "Submit the completed fact-check analysis with all required fields.",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": ["accurate", "misleading", "unverified"],
                "description": "Overall verdict on the claim",
            },
            "confidence": {
                "type": "string",
                "enum": ["high", "medium", "low"],
                "description": "Confidence level in the verdict",
            },
            "explanation": {
                "type": "string",
                "description": "Detailed explanation of the verdict with evidence",
            },
            "claims": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Specific claims extracted from the content",
            },
            "sources": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Evidence links or authoritative source references used",
            },
            "platform_likelihood": {
                "type": "object",
                "properties": {
                    "whatsapp": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Likelihood (0–100) this circulates on WhatsApp",
                    },
                    "tiktok": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Likelihood (0–100) this circulates on TikTok",
                    },
                    "facebook": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Likelihood (0–100) this circulates on Facebook",
                    },
                },
                "required": ["whatsapp", "tiktok", "facebook"],
            },
            "harm_severity": {
                "type": "string",
                "enum": ["low", "medium", "high", "critical"],
                "description": "Severity of potential harm if believed and acted upon",
            },
            "harm_category": {
                "type": "string",
                "enum": [
                    "health",
                    "financial",
                    "racial",
                    "political",
                    "government_impersonation",
                ],
                "description": "Primary category of harm",
            },
            "consequence_mapping": {
                "type": "string",
                "description": "Real-world consequences if this misinformation is believed and acted upon in Singapore",
            },
            "multilingual_summaries": {
                "type": "object",
                "properties": {
                    "en": {"type": "string", "description": "English summary"},
                    "zh": {
                        "type": "string",
                        "description": "Simplified Chinese (Mandarin) summary",
                    },
                    "ms": {
                        "type": "string",
                        "description": "Bahasa Melayu summary",
                    },
                    "ta": {"type": "string", "description": "Tamil summary"},
                },
                "required": ["en", "zh", "ms", "ta"],
                "description": "Fact-check summary in Singapore's four official languages",
            },
            "demographic_vulnerability": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of up to 4 short demographic group names in Singapore most vulnerable to this content (e.g. 'Elderly Mandarin speakers', 'Migrant workers', 'General public'). Short names only — no sentences, no explanations.",
                "maxItems": 4,
            },
        },
        "required": [
            "verdict",
            "confidence",
            "explanation",
            "claims",
            "sources",
            "platform_likelihood",
            "harm_severity",
            "harm_category",
            "consequence_mapping",
            "multilingual_summaries",
            "demographic_vulnerability",
        ],
    },
}


def _is_trusted_domain(url: str) -> bool:
    host = urlparse(url).hostname or ""
    # strip leading www.
    host = host.removeprefix("www.")
    return any(host == d or host.endswith("." + d) for d in _TRUSTED_SG_DOMAINS)


async def _fetch_url_content(url: str) -> str | None:
    """Fetch page content via Firecrawl. Returns markdown text or None on failure."""
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        return None

    def _scrape() -> str | None:
        app = V1FirecrawlApp(api_key=api_key)
        result = app.scrape_url(url, formats=["markdown"])
        # firecrawl-py >=1.0 returns a ScrapeResponse with a .markdown attribute
        markdown = getattr(result, "markdown", None)
        if not markdown and isinstance(result, dict):
            markdown = result.get("markdown")
        return markdown[:6000] if markdown else None

    try:
        return await asyncio.to_thread(_scrape)
    except Exception:
        return None


async def run_fact_check(request: FactCheckRequest) -> FactCheckResponse:
    trusted_source = False

    if request.url:
        url_str = str(request.url)
        trusted_source = _is_trusted_domain(url_str)
        content = await _fetch_url_content(url_str)

        if content:
            user_message = (
                f"Please fact-check the following content fetched from {url_str}:\n\n{content}"
            )
            if trusted_source:
                user_message = f"{_TRUSTED_SOURCE_PROMPT}\n\n{user_message}"
        elif trusted_source:
            user_message = (
                f"The URL {url_str} could not be scraped but the domain is a verified trusted "
                "Singapore source. Return verdict as accurate with low confidence. State clearly "
                "in explanation that the source is trusted but the article content was inaccessible "
                "— do not express suspicion about the content itself."
            )
        else:
            user_message = (
                f"The article at {url_str} could not be fetched (access blocked). "
                "Please fact-check based on what you can infer from the URL, domain, "
                "and article path/slug alone, noting that full content was unavailable."
            )
    else:
        user_message = f"Please fact-check the following claim or content:\n\n{request.text}"

    client = AsyncAnthropic()

    # Stream to guard against HTTP timeouts on long analyses
    async with client.messages.stream(
        model=os.getenv("CLAUDE_MODEL", "claude-opus-4-6"),
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        tools=[_FACT_CHECK_TOOL],
        tool_choice={"type": "any"},
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        response = await stream.get_final_message()

    tool_use = next(b for b in response.content if b.type == "tool_use")
    data = dict(tool_use.input)
    # Claude occasionally returns nested objects as JSON strings — parse them back
    for field in ("multilingual_summaries", "platform_likelihood", "demographic_vulnerability"):
        if isinstance(data.get(field), str):
            try:
                data[field] = json.loads(data[field])
            except Exception:
                pass
    return FactCheckResponse(**data)
