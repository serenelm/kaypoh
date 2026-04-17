from __future__ import annotations

import ast
import json
import logging
import re
from typing import Any, Literal

from pydantic import BaseModel, HttpUrl, field_validator, model_validator  # model_validator kept for FactCheckRequest

logger = logging.getLogger(__name__)


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
    platform_likelihood: dict[str, Any]
    harm_severity: Literal["low", "medium", "high", "critical"]
    harm_category: Literal[
        "health", "financial", "racial", "political", "government_impersonation"
    ]
    consequence_mapping: str
    multilingual_summaries: dict[str, Any]
    demographic_vulnerability: list[str]

    @field_validator("multilingual_summaries", "platform_likelihood", mode="before")
    @classmethod
    def parse_dict_field(cls, v: Any) -> Any:
        if isinstance(v, str):
            # Try direct parse first
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                pass

            # Replace all types of quotes and dashes
            v_fixed = v
            # Unicode dashes and quotes
            v_fixed = v_fixed.replace('—', '-').replace('–', '-')  # em-dash, en-dash
            v_fixed = v_fixed.replace('"', '"').replace('"', '"')  # curly quotes
            v_fixed = v_fixed.replace(''', "'").replace(''', "'")  # smart single quotes
            v_fixed = v_fixed.replace('´', "'").replace('`', "'")  # accents to quotes

            try:
                return json.loads(v_fixed)
            except json.JSONDecodeError:
                pass

            # Try ast.literal_eval as a fallback (Python-style dict/list)
            try:
                return ast.literal_eval(v_fixed)
            except (ValueError, SyntaxError):
                pass

            # Last resort: try extracting key-value pairs with regex
            try:
                result = {}
                # Look for patterns like "key": "value"
                pattern = r'"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"'
                matches = re.findall(pattern, v_fixed)
                if matches:
                    for key, val in matches:
                        # Unescape the value
                        result[key] = val.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
                    if result:
                        logger.info(f"Recovered dict from regex parsing: {len(result)} keys")
                        return result
            except Exception:
                pass

            logger.error(f"Failed to parse dict field after all attempts")
            return {}

        return v if isinstance(v, dict) else {}

    @field_validator("demographic_vulnerability", mode="before")
    @classmethod
    def parse_list_field(cls, v: Any) -> Any:
        if isinstance(v, str):
            # Try direct parse first
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                pass

            # Replace all types of quotes and dashes
            v_fixed = v
            v_fixed = v_fixed.replace('—', '-').replace('–', '-')  # em-dash, en-dash
            v_fixed = v_fixed.replace('"', '"').replace('"', '"')  # curly quotes
            v_fixed = v_fixed.replace(''', "'").replace(''', "'")  # smart single quotes
            v_fixed = v_fixed.replace('´', "'").replace('`', "'")  # accents to quotes

            try:
                return json.loads(v_fixed)
            except json.JSONDecodeError:
                pass

            # Try ast.literal_eval as a fallback
            try:
                return ast.literal_eval(v_fixed)
            except (ValueError, SyntaxError):
                pass

            # Last resort: try extracting list items with regex
            try:
                result = []
                # Look for quoted strings in the list
                pattern = r'"((?:[^"\\]|\\.)*)"'
                matches = re.findall(pattern, v_fixed)
                if matches:
                    for val in matches:
                        # Unescape the value
                        result.append(val.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\'))
                    if result:
                        logger.info(f"Recovered list from regex parsing: {len(result)} items")
                        return result
            except Exception:
                pass

            logger.error(f"Failed to parse list field after all attempts")
            return []

        return v if isinstance(v, list) else []


class FactCheckResult(FactCheckResponse):
    """HTTP response — extends FactCheckResponse with server-side metadata."""
    submission_id: int
    similar_claims_count: int = 0
    similar_claims_topic: str | None = None
