from __future__ import annotations

import re
import unicodedata

_SLUG_STRIP_RE = re.compile(r"[^\w\-]+", re.UNICODE)
_SLUG_HYPHENATE_RE = re.compile(r"[\s]+", re.UNICODE)


def slugify(value: str) -> str:
    """URL-safe slug that keeps non-ASCII word chars (e.g. Korean) intact."""
    value = unicodedata.normalize("NFC", str(value)).strip().lower()
    value = _SLUG_HYPHENATE_RE.sub("-", value)
    value = _SLUG_STRIP_RE.sub("", value)
    return value or "untitled"


def excerpt(html: str, max_chars: int = 220) -> str:
    """Strip tags for a plain-text list-page excerpt."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "…"
