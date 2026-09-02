"""Content discovery + markdown/front-matter parsing."""

from __future__ import annotations

import datetime
import html as html_lib
import re
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import markdown
import yaml

FRONT_MATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n?(.*)$", re.DOTALL)

MD_EXTENSIONS = [
    "fenced_code",
    "codehilite",
    "tables",
    "toc",
    "footnotes",
    "attr_list",
    "sane_lists",
    "md_in_html",  # lets markdown-in-<tag markdown="1"> (e.g. <details>) render properly
]

MD_EXTENSION_CONFIGS = {
    "codehilite": {"css_class": "highlight", "guess_lang": False},
    "toc": {"permalink": "#", "permalink_class": "heading-anchor"},
}

# -- a small compatibility shim for leftover Hugo shortcodes in migrated
# content ({{< figure >}}, {{< youtube >}}, {{< icon >}}, {{< tabs >}}/{{< tab >}}) --

_FIGURE_RE = re.compile(r"\{\{<\s*figure\s+(.*?)\s*/?>\}\}")
_YOUTUBE_RE = re.compile(r"\{\{<\s*youtube\s+([\w-]+)(?:\s+(.*?))?\s*/?>\}\}")
_ICON_RE = re.compile(r"\{\{<\s*icon\s+(.*?)\s*/?>\}\}\s*")
_ICON_NAMES = {"github", "youtube", "x", "linkedin"}

_TABS_OPEN_RE = re.compile(r"^\s*\{\{<\s*tabs\s*>\}\}\s*$")
_TABS_CLOSE_RE = re.compile(r"^\s*\{\{<\s*/tabs\s*>\}\}\s*$")
_TAB_OPEN_RE = re.compile(r'^\s*\{\{<\s*tab\s+label="([^"]*)"\s*>\}\}\s*$')
_TAB_CLOSE_RE = re.compile(r"^\s*\{\{<\s*/tab\s*>\}\}\s*$")

# #pitch { ... } - a click/swipe-through slide deck (e.g. Problem -> Solution
# -> Result). Usable in any .md file; a `##` heading starts each new slide
# (its text becomes the slide's title - no separate markup needed), and the
# nav chrome/interaction are built client-side by pitch-deck code in main.js,
# keyed off the .pitch-deck/.pitch-slide markup emitted here.
#
#   #pitch {
#   ## Problem
#   ...
#
#   ## Solution
#   ...
#   }
_PITCH_OPEN_RE = re.compile(r"^\s*#pitch\s*\{\s*$")
_PITCH_CLOSE_RE = re.compile(r"^\s*\}\s*$")
_PITCH_SLIDE_RE = re.compile(r"^##\s+(.+?)\s*$")

# #slideshow { ... } - same pitch-deck output as #pitch above, but with each
# slide written as a brace block (`Title { ... };`) instead of a `##`
# heading, and the whole thing closed with `};`. The title is optional - a
# bare `{ ... };` makes an untitled slide (no eyebrow, dot falls back to
# "Slide N" - same fallback the pitch-deck JS already does for a missing
# data-slide-title). Content inside a slide can be indented however you
# like - it's dedented as a block before being handed to markdown, so
# indentation doesn't get misread as a code block.
#
#   #slideshow {
#       Problem {
#           ...
#       };
#
#       {
#           untitled slide
#       };
#
#       Title : align = "cc" {
#           content aligned center/center instead of the default top-left
#       };
#   };
_SLIDESHOW_OPEN_RE = re.compile(r"^\s*#slideshow\s*\{\s*$")
_SLIDESHOW_CLOSE_RE = re.compile(r"^\s*\};\s*$")
_SLIDESHOW_SLIDE_OPEN_RE = re.compile(r"^\s*(.*?)\s*\{\s*$")
_SLIDESHOW_ALIGN_RE = re.compile(r'^(.*?)\s*:\s*align\s*=\s*"([tcb][lcr])"\s*$')
_SLIDESHOW_VALIGN_CSS = {"t": "start", "c": "center", "b": "end"}
_SLIDESHOW_HALIGN_CSS = {"l": "left", "c": "center", "r": "right"}


def _parse_slideshow_slide_header(header: str) -> tuple[str, str]:
    """`Title : align = "tl" ` -> (title, align_code). Align is optional and
    defaults to "tl" (top-left) - the two chars are {t,c,b}{l,c,r}, matching
    CSS align-self / text-align on the slide."""
    m = _SLIDESHOW_ALIGN_RE.match(header)
    if m:
        return m.group(1).strip(), m.group(2)
    return header.strip(), "tl"


def _slideshow_align_style(align: str) -> str:
    valign, halign = align[0], align[1]
    return f"align-self:{_SLIDESHOW_VALIGN_CSS[valign]};text-align:{_SLIDESHOW_HALIGN_CSS[halign]}"


def _parse_shortcode_attrs(raw: str) -> dict[str, str]:
    return dict(re.findall(r'(\w+)="([^"]*)"', raw))


def _figure_repl(m: re.Match) -> str:
    attrs = _parse_shortcode_attrs(m.group(1))
    src = html_lib.escape(attrs.get("src", ""), quote=True)
    caption = attrs.get("attr")
    width = attrs.get("width")
    style = f' style="max-width:{int(width)}px"' if width and width.isdigit() else ""
    alt = html_lib.escape(caption or "", quote=True)
    img = f'<img src="{src}" alt="{alt}">'
    if caption:
        return f'<figure class="md-figure"{style}>{img}<figcaption>{html_lib.escape(caption)}</figcaption></figure>'
    return f'<figure class="md-figure"{style}>{img}</figure>'


def _icon_repl(m: re.Match) -> str:
    attrs = _parse_shortcode_attrs(m.group(1))
    name = attrs.get("name", "")
    if name not in _ICON_NAMES:
        return ""
    return f'<span class="icon-inline icon-{name}" aria-hidden="true"></span>'


def _youtube_repl(m: re.Match) -> str:
    vid = html_lib.escape(m.group(1), quote=True)
    attrs = _parse_shortcode_attrs(m.group(2) or "")
    width = attrs.get("width")
    style = f' style="max-width:{int(width)}px;margin-left:auto;margin-right:auto"' if width and width.isdigit() else ""
    return (
        f'<div class="embed-responsive"{style}><iframe src="https://www.youtube-nocookie.com/embed/{vid}" '
        f'title="YouTube video" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" '
        f'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" '
        f'allowfullscreen></iframe></div>'
    )


def preprocess_shortcodes(body: str) -> str:
    """Expand the handful of Hugo shortcodes this content actually uses into
    plain HTML, ahead of markdown conversion. Not a general Hugo shortcode
    engine - just enough to not lose content that was written for one."""
    out_lines = []
    in_tabs = False
    first_tab = False
    in_pitch = False
    pitch_slide_open = False
    in_slideshow = False
    in_slide = False
    slide_title = ""
    slide_align = "tl"
    slide_lines: list[str] = []
    for line in body.split("\n"):
        if in_pitch:
            if _PITCH_CLOSE_RE.match(line):
                if pitch_slide_open:
                    out_lines.append("")
                    out_lines.append("</div>")
                out_lines.append("</div>")
                in_pitch = pitch_slide_open = False
                continue
            m = _PITCH_SLIDE_RE.match(line)
            if m:
                if pitch_slide_open:
                    out_lines.append("")
                    out_lines.append("</div>")
                title = html_lib.escape(m.group(1), quote=True)
                out_lines.append(f'<div class="pitch-slide" data-slide-title="{title}" markdown="1">')
                out_lines.append("")
                pitch_slide_open = True
                continue
            line = _FIGURE_RE.sub(_figure_repl, line)
            line = _YOUTUBE_RE.sub(_youtube_repl, line)
            line = _ICON_RE.sub(_icon_repl, line)
            out_lines.append(line)
            continue
        if in_slideshow:
            if in_slide:
                if _SLIDESHOW_CLOSE_RE.match(line):
                    title = html_lib.escape(slide_title, quote=True)
                    style = _slideshow_align_style(slide_align)
                    out_lines.append(f'<div class="pitch-slide" data-slide-title="{title}" style="{style}" markdown="1">')
                    out_lines.append("")
                    # Content is written indented to taste inside `Title { ... };` -
                    # dedent it as a block so markdown doesn't read it as a code
                    # block (its 4-space-indent rule).
                    out_lines.append(textwrap.dedent("\n".join(slide_lines)).strip("\n"))
                    out_lines.append("")
                    out_lines.append("</div>")
                    in_slide = False
                    slide_lines = []
                    continue
                line = _FIGURE_RE.sub(_figure_repl, line)
                line = _YOUTUBE_RE.sub(_youtube_repl, line)
                line = _ICON_RE.sub(_icon_repl, line)
                slide_lines.append(line)
                continue
            if _SLIDESHOW_CLOSE_RE.match(line):
                out_lines.append("</div>")
                in_slideshow = False
                continue
            m = _SLIDESHOW_SLIDE_OPEN_RE.match(line)
            if m:
                slide_title, slide_align = _parse_slideshow_slide_header(m.group(1))
                in_slide = True
                slide_lines = []
                continue
            continue  # blank/stray line between slide blocks - ignore
        if _TABS_OPEN_RE.match(line):
            # outer wrapper needs markdown="1" too, or md_in_html treats the
            # whole thing as one opaque raw-HTML block and never re-examines
            # the markdown="1" children nested inside it for markdown.
            out_lines.append('<div class="md-tabs" markdown="1">')
            in_tabs, first_tab = True, True
            continue
        if _TABS_CLOSE_RE.match(line):
            out_lines.append("</div>")
            in_tabs = False
            continue
        m = _TAB_OPEN_RE.match(line)
        if m:
            open_attr = " open" if first_tab else ""
            first_tab = False
            out_lines.append(f'<details class="md-tab" markdown="1"{open_attr}>')
            out_lines.append(f"<summary>{html_lib.escape(m.group(1))}</summary>")
            out_lines.append("")
            continue
        if _TAB_CLOSE_RE.match(line):
            out_lines.append("")
            out_lines.append("</details>")
            continue
        if _PITCH_OPEN_RE.match(line):
            # markdown="1" here too - see the note by the tabs wrapper above.
            out_lines.append('<div class="pitch-deck" data-pitch tabindex="0" markdown="1">')
            in_pitch = True
            continue
        if _SLIDESHOW_OPEN_RE.match(line):
            out_lines.append('<div class="pitch-deck" data-pitch tabindex="0" markdown="1">')
            in_slideshow = True
            continue
        line = _FIGURE_RE.sub(_figure_repl, line)
        line = _YOUTUBE_RE.sub(_youtube_repl, line)
        line = _ICON_RE.sub(_icon_repl, line)
        out_lines.append(line)
    return "\n".join(out_lines)


def parse_front_matter(text: str) -> tuple[dict, str]:
    """Split a content file into (front-matter dict, remaining body text)."""
    m = FRONT_MATTER_RE.match(text)
    if not m:
        return {}, text
    fm_text, body = m.groups()
    meta = yaml.safe_load(fm_text) or {}
    if not isinstance(meta, dict):
        raise ValueError("front matter must be a YAML mapping")
    return meta, body


def render_markdown(body: str) -> tuple[str, list[dict]]:
    """Render markdown body to HTML. Returns (html, toc_items)."""
    md = markdown.Markdown(
        extensions=MD_EXTENSIONS,
        extension_configs=MD_EXTENSION_CONFIGS,
        output_format="html5",
    )
    html = md.convert(preprocess_shortcodes(body))
    toc_tokens = getattr(md, "toc_tokens", []) or []
    return html, toc_tokens


def normalize_date(value: Any) -> datetime.date | None:
    if value is None:
        return None
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value if isinstance(value, datetime.date) else value.date()
    return datetime.date.fromisoformat(str(value))


@dataclass
class Page:
    section: str          # e.g. "posts", "projects", "" for standalone
    slug: str              # directory / file stem, used in the URL
    lang: str               # e.g. "en", "ko"
    is_list: bool           # True for _index bundles (section landing pages)
    meta: dict = field(default_factory=dict)
    body_html: str = ""
    toc: list = field(default_factory=list)
    source_dir: Path | None = None   # directory holding resources/, if any
    url: str = ""           # filled in by the builder (root-relative, e.g. /posts/foo/)

    @property
    def title(self) -> str:
        return self.meta.get("title", self.slug)

    @property
    def date(self):
        return normalize_date(self.meta.get("date"))

    @property
    def draft(self) -> bool:
        return bool(self.meta.get("draft", False))

    @property
    def tags(self) -> list[str]:
        return list(self.meta.get("tags") or [])

    @property
    def categories(self) -> list[str]:
        return list(self.meta.get("categories") or [])

    @property
    def series(self) -> list[str]:
        return list(self.meta.get("series") or [])

    @property
    def series_order(self) -> float | None:
        """Optional position within a series (lower comes first). Falls back
        to date order (oldest first) when unset, since a series is normally
        read front-to-back rather than newest-first."""
        v = self.meta.get("series_order")
        return None if v is None else float(v)

    @property
    def description(self) -> str:
        return self.meta.get("description") or self.meta.get("summary") or ""

    @property
    def cover(self) -> str | None:
        return self.meta.get("cover")

    @property
    def weight(self) -> float | None:
        """Optional manual sort key (lower sorts first). Set `weight:` in
        front matter to pin a page ahead of date-based ordering."""
        w = self.meta.get("weight")
        return None if w is None else float(w)

    def sort_key(self):
        """Weighted pages sort first, by ascending weight; everything else
        falls back to date, newest first."""
        date_ord = self.date.toordinal() if self.date else 0
        if self.weight is not None:
            return (0, self.weight, -date_ord)
        return (1, 0, -date_ord)


def _lang_suffix_for(filename: str, base: str, languages: list[str], default_lang: str) -> str | None:
    """Given a filename like 'index.ko.md' or 'index.md', return its language."""
    if filename == f"{base}.md":
        return default_lang
    for lang in languages:
        if lang == default_lang:
            continue
        if filename == f"{base}.{lang}.md":
            return lang
    return None


def discover_bundle(dir_path: Path, languages: list[str], default_lang: str, is_list: bool) -> dict[str, tuple[dict, str]]:
    """Find index/_index files for each language in a directory.

    Returns {lang: (meta, body_text)}.
    """
    base = "_index" if is_list else "index"
    found: dict[str, tuple[dict, str]] = {}
    for entry in dir_path.iterdir():
        if not entry.is_file():
            continue
        lang = _lang_suffix_for(entry.name, base, languages, default_lang)
        if lang is None:
            continue
        text = entry.read_text(encoding="utf-8")
        meta, body = parse_front_matter(text)
        found[lang] = (meta, body)
    return found


def load_section(
    content_dir: Path,
    section: str,
    languages: list[str],
    default_lang: str,
) -> tuple[dict[str, Page], list[Page]]:
    """Load a section's _index (list) pages and its item bundles.

    Returns (list_pages_by_lang, item_pages).
    """
    section_dir = content_dir / section
    list_pages: dict[str, Page] = {}
    items: list[Page] = []

    if not section_dir.is_dir():
        return list_pages, items

    index_found = discover_bundle(section_dir, languages, default_lang, is_list=True)
    for lang, (meta, body) in index_found.items():
        html, toc = render_markdown(body)
        list_pages[lang] = Page(
            section=section, slug="", lang=lang, is_list=True,
            meta=meta, body_html=html, toc=toc, source_dir=section_dir,
        )

    for entry in sorted(section_dir.iterdir()):
        if not entry.is_dir():
            continue
        bundle = discover_bundle(entry, languages, default_lang, is_list=False)
        if not bundle:
            continue
        for lang, (meta, body) in bundle.items():
            html, toc = render_markdown(body)
            page = Page(
                section=section, slug=entry.name, lang=lang, is_list=False,
                meta=meta, body_html=html, toc=toc, source_dir=entry,
            )
            if page.draft:
                continue
            items.append(page)

    return list_pages, items
