from __future__ import annotations

import hashlib
import shutil
import time
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pygments.formatters import HtmlFormatter

from .content import Page, load_section
from .util import excerpt, slugify

SSG_ROOT = Path(__file__).resolve().parent.parent


def _rmtree_retry(path: Path, attempts: int = 5, delay: float = 0.3):
    """shutil.rmtree with retries: on Windows, an AV/indexer can transiently
    hold a handle open on a just-written file right after a build."""
    for i in range(attempts):
        try:
            shutil.rmtree(path)
            return
        except PermissionError:
            if i == attempts - 1:
                raise
            time.sleep(delay)


def load_config(config_path: Path) -> dict:
    cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    cfg["_root"] = config_path.parent
    return cfg


def _resolve(root: Path, path: str) -> Path:
    p = Path(path)
    return p if p.is_absolute() else (root / p).resolve()


class Site:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.root = cfg["_root"]
        self.content_dir = _resolve(self.root, cfg["content_dir"])
        self.static_dirs = [_resolve(self.root, d) for d in cfg.get("static_dirs", [])]
        self.output_dir = _resolve(self.root, cfg.get("output_dir", "public"))
        self.sections = cfg.get("sections", {})
        self.languages = list(cfg.get("languages", {}).keys())
        self.default_lang = self.languages[0]
        self.base_url = cfg.get("base_url", "/").rstrip("/") + "/"

        self.list_pages: dict[str, dict[str, Page]] = {}   # section -> lang -> Page
        self.items: dict[str, list[Page]] = {}              # section -> [Page]

    # -- discovery ---------------------------------------------------
    def load(self):
        for section in self.sections:
            list_pages, items = load_section(
                self.content_dir, section, self.languages, self.default_lang
            )
            self.list_pages[section] = list_pages
            self.items[section] = items
            for p in list_pages.values():
                p.url = self.url_for(p)
            for p in items:
                p.url = self.url_for(p)

    # -- URLs ----------------------------------------------------------
    def lang_prefix(self, lang: str) -> str:
        return "" if lang == self.default_lang else f"/{lang}"

    def url_for(self, page: Page) -> str:
        prefix = self.lang_prefix(page.lang)
        if page.is_list:
            return f"{prefix}/{page.section}/" if page.section else f"{prefix}/"
        return f"{prefix}/{page.section}/{page.slug}/"

    def home_url(self, lang: str) -> str:
        return f"{self.lang_prefix(lang)}/"

    def tags_index_url(self, lang: str) -> str:
        return f"{self.lang_prefix(lang)}/tags/"

    def tag_url(self, lang: str, tag: str) -> str:
        return f"{self.lang_prefix(lang)}/tags/{slugify(tag)}/"

    def series_index_url(self, lang: str) -> str:
        return f"{self.lang_prefix(lang)}/series/"

    def series_url(self, lang: str, name: str) -> str:
        return f"{self.lang_prefix(lang)}/series/{slugify(name)}/"

    def cover_url(self, page: Page) -> str | None:
        if not page.cover:
            return None
        cover = str(page.cover)
        if cover.startswith(("/", "http://", "https://")):
            return cover  # root-relative (static/) or absolute - use as-is
        return page.url.rstrip("/") + "/" + cover.lstrip("/")

    # -- items per language --------------------------------------------
    def items_for_lang(self, section: str, lang: str) -> list[Page]:
        pages = [p for p in self.items.get(section, []) if p.lang == lang]
        pages.sort(key=lambda p: p.sort_key())
        return pages

    def all_items_for_lang(self, lang: str) -> list[Page]:
        out: list[Page] = []
        for section in self.sections:
            out.extend(self.items_for_lang(section, lang))
        out.sort(key=lambda p: p.sort_key())
        return out

    def tags_for_lang(self, lang: str) -> dict[str, list[Page]]:
        tags: dict[str, list[Page]] = {}
        for p in self.all_items_for_lang(lang):
            for t in p.tags:
                tags.setdefault(t, []).append(p)
        return dict(sorted(tags.items(), key=lambda kv: kv[0].lower()))

    def series_for_lang(self, lang: str) -> dict[str, list[Page]]:
        """Group items by series name. Posts within a series are ordered by
        `series_order` (falling back to date, oldest first); series
        themselves are ordered by their most recently published post,
        newest first."""
        series: dict[str, list[Page]] = {}
        for p in self.all_items_for_lang(lang):
            for s in p.series:
                series.setdefault(s, []).append(p)

        def entry_key(p: Page):
            date_ord = p.date.toordinal() if p.date else 0
            if p.series_order is not None:
                return (0, p.series_order, date_ord)
            return (1, 0, date_ord)

        for posts in series.values():
            posts.sort(key=entry_key)

        def latest(posts: list[Page]) -> int:
            return max((p.date.toordinal() if p.date else 0) for p in posts)

        return dict(sorted(series.items(), key=lambda kv: latest(kv[1]), reverse=True))

    def alt_urls(self, section: str, slug: str) -> dict[str, str]:
        """Map lang -> url of the same content item in that language, if it exists."""
        out = {}
        for p in self.items.get(section, []):
            if p.slug == slug:
                out[p.lang] = p.url
        return out


class Builder:
    def __init__(self, site: Site):
        self.site = site
        self.env = Environment(
            loader=FileSystemLoader(str(SSG_ROOT / "templates")),
            autoescape=select_autoescape(["html"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.env.filters["dateformat"] = self._dateformat
        self.env.filters["slugify"] = slugify
        # Cache-buster for /css/style.css - the URL never changes between
        # builds, so without this a browser can happily keep serving a
        # stale copy after a CSS edit even past a normal reload.
        self.asset_v = self._hash_asset("static/css/style.css")

    def _hash_asset(self, rel_path: str) -> str:
        path = _resolve(self.site.root, rel_path)
        try:
            return hashlib.sha1(path.read_bytes()).hexdigest()[:8]
        except FileNotFoundError:
            return "0"

    def _dateformat(self, date, lang: str) -> str:
        if date is None:
            return ""
        fmt = self.site.cfg["languages"][lang].get("date_format", "%Y-%m-%d")
        try:
            return date.strftime(fmt.replace("%-d", str(date.day)))
        except ValueError:
            return date.isoformat()

    def base_context(self, lang: str, active_url: str, lang_urls: dict | None = None) -> dict:
        cfg = self.site.cfg
        author = cfg.get("author", {})
        nav = []
        for section, labels in self.site.sections.items():
            label = labels.get(f"label_{lang}", labels.get("label_en", section.title()))
            nav.append({"label": label, "url": f"{self.site.lang_prefix(lang)}/{section}/"})
        resolved_lang_urls = {l: self.site.home_url(l) for l in self.site.languages}
        if lang_urls:
            resolved_lang_urls.update({k: v for k, v in lang_urls.items() if v})
        return {
            "site": {
                "title": cfg.get("title", ""),
                "description": cfg.get("description", ""),
                "base_url": self.site.base_url,
                "social": cfg.get("social", []),
            },
            "author": {
                "name": author.get(f"name_{lang}", author.get("name", "")),
                "title": author.get(f"title_{lang}", author.get("title", "")),
                "avatar": author.get("avatar", ""),
            },
            "lang": lang,
            "languages": [
                {"code": code, "label": meta.get("label", code)}
                for code, meta in cfg.get("languages", {}).items()
            ],
            "nav": nav,
            "home_url": self.site.home_url(lang),
            "tags_index_url": self.site.tags_index_url(lang),
            "series_index_url": self.site.series_index_url(lang),
            "active_url": active_url,
            "lang_urls": resolved_lang_urls,
            "asset_v": self.asset_v,
        }

    def render(self, template_name: str, out_path: Path, **ctx):
        template = self.env.get_template(template_name)
        html = template.render(**ctx)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(html, encoding="utf-8")

    # -- build steps -----------------------------------------------------
    def build_all(self):
        site = self.site
        out = site.output_dir
        if out.exists():
            _rmtree_retry(out)
        out.mkdir(parents=True, exist_ok=True)

        self.copy_static()
        self.write_highlight_css()

        for lang in site.languages:
            self.build_home(lang)
            for section in site.sections:
                self.build_section(section, lang)
            self.build_tags(lang)
            self.build_series(lang)
            self.build_rss(lang)

    def copy_static(self):
        for static_dir in self.site.static_dirs:
            if not static_dir.is_dir():
                continue
            for entry in static_dir.rglob("*"):
                if entry.is_file():
                    rel = entry.relative_to(static_dir)
                    dest = self.site.output_dir / rel
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(entry, dest)

    def write_highlight_css(self):
        css = HtmlFormatter(style="github-dark").get_style_defs(".highlight")
        out_path = self.site.output_dir / "css" / "highlight.css"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(css, encoding="utf-8")

    def _copy_resources(self, page: Page, dest_dir: Path):
        if page.source_dir is None:
            return
        res = page.source_dir / "resources"
        if res.is_dir():
            shutil.copytree(res, dest_dir / "resources", dirs_exist_ok=True)

    def build_home(self, lang: str):
        site = self.site
        ctx = self.base_context(lang, site.home_url(lang))
        self.render("home.html", site.output_dir / lang_out(site, lang) / "index.html", **ctx)

    def _card(self, page: Page, lang: str) -> dict:
        return {
            "title": page.title,
            "url": page.url,
            "date": page.date,
            "date_str": self._dateformat(page.date, lang),
            "description": page.description or excerpt(page.body_html),
            "cover": self.site.cover_url(page),
            "tags": page.tags,
            "section": page.section,
        }

    def _group_by_category(self, items: list[Page], lang: str) -> list[dict] | None:
        """Group items by their first `categories:` entry, in the order each
        category is first encountered (so a higher-`weight`/newer item's
        category floats its whole group up). Returns None - meaning "render
        flat, no grouping" - unless at least two distinct categories are
        actually in use, so a section nobody has categorized (e.g. posts,
        studies, by default) is unaffected."""
        seen: dict[str, list[Page]] = {}
        uncategorized: list[Page] = []
        for p in items:
            cat = p.categories[0] if p.categories else None
            if cat is None:
                uncategorized.append(p)
            else:
                seen.setdefault(cat, []).append(p)
        if len(seen) < 2:
            return None
        # note: key is "cards", not "items" - dicts have a builtin .items()
        # method, and Jinja2's attribute lookup (group.items) would silently
        # resolve to that bound method instead of a KeyError, so pick a name
        # that can't collide with a dict method.
        groups = [{"name": name, "cards": [self._card(p, lang) for p in pages]} for name, pages in seen.items()]
        if uncategorized:
            groups.append({"name": None, "cards": [self._card(p, lang) for p in uncategorized]})
        return groups

    def build_section(self, section: str, lang: str):
        site = self.site
        list_page = site.list_pages.get(section, {}).get(lang)
        items = site.items_for_lang(section, lang)
        section_lang_urls = {
            l: f"{site.lang_prefix(l)}/{section}/"
            for l in site.languages
            if l in site.list_pages.get(section, {})
        }
        ctx = self.base_context(lang, f"{site.lang_prefix(lang)}/{section}/", section_lang_urls)
        ctx["section"] = section
        ctx["title"] = (list_page.title if list_page else section.title())
        ctx["description"] = list_page.description if list_page else ""
        ctx["intro_html"] = list_page.body_html if list_page else ""
        ctx["items"] = [self._card(p, lang) for p in items]
        ctx["groups"] = self._group_by_category(items, lang)
        out_path = site.output_dir / lang_out(site, lang) / section / "index.html"
        self.render("list.html", out_path, **ctx)

        for page in items:
            self.build_single(page)

    def build_single(self, page: Page):
        site = self.site
        alt = site.alt_urls(page.section, page.slug)
        ctx = self.base_context(page.lang, page.url, alt)
        ctx["page"] = {
            "slug": page.slug,
            "title": page.title,
            "date": page.date,
            "date_str": self._dateformat(page.date, page.lang),
            "description": page.description,
            "tags": page.tags,
            "categories": page.categories,
            "series": page.series,
            "cover": site.cover_url(page),
            "body_html": page.body_html,
            "toc": page.toc,
            "link": page.meta.get("link"),
            "status": page.meta.get("status"),
        }
        ctx["section"] = page.section
        ctx["series_nav"] = self._series_nav(page)
        rel_dir = site.output_dir / lang_out(site, page.lang) / page.section / page.slug
        self.render("single.html", rel_dir / "index.html", **ctx)
        self._copy_resources(page, rel_dir)

    def _series_nav(self, page: Page) -> dict | None:
        """A single post can list more than one series in front matter, but
        the navigator only makes sense for one - use the first, and only
        bother if that series actually has more than this one post in it."""
        if not page.series:
            return None
        name = page.series[0]
        siblings = self.site.series_for_lang(page.lang).get(name, [])
        if len(siblings) < 2:
            return None
        index = next((i for i, s in enumerate(siblings) if s is page), None)
        return {
            "name": name,
            "url": self.site.series_url(page.lang, name),
            "posts": [{"title": s.title, "url": s.url, "current": s is page} for s in siblings],
            "prev": siblings[index - 1] if index is not None and index > 0 else None,
            "next": siblings[index + 1] if index is not None and index + 1 < len(siblings) else None,
        }

    def build_tags(self, lang: str):
        site = self.site
        tags = site.tags_for_lang(lang)
        tags_lang_urls = {l: site.tags_index_url(l) for l in site.languages}
        ctx = self.base_context(lang, site.tags_index_url(lang), tags_lang_urls)
        ctx["tags"] = [
            {"name": t, "url": site.tag_url(lang, t), "count": len(items)}
            for t, items in tags.items()
        ]
        self.render("tags_index.html", site.output_dir / lang_out(site, lang) / "tags" / "index.html", **ctx)

        for tag, items in tags.items():
            tctx = self.base_context(lang, site.tag_url(lang, tag))
            tctx["title"] = tag
            tctx["description"] = ""
            tctx["intro_html"] = ""
            tctx["items"] = [self._card(p, lang) for p in items]
            self.render(
                "list.html",
                site.output_dir / lang_out(site, lang) / "tags" / slugify(tag) / "index.html",
                **tctx,
            )

    def build_series(self, lang: str):
        site = self.site
        series = site.series_for_lang(lang)
        series_lang_urls = {l: site.series_index_url(l) for l in site.languages}
        ctx = self.base_context(lang, site.series_index_url(lang), series_lang_urls)
        ctx["series"] = [
            {"name": name, "url": site.series_url(lang, name), "count": len(items)}
            for name, items in series.items()
        ]
        self.render(
            "series_index.html",
            site.output_dir / lang_out(site, lang) / "series" / "index.html",
            **ctx,
        )

        for name, items in series.items():
            sctx = self.base_context(lang, site.series_url(lang, name))
            sctx["title"] = name
            sctx["description"] = ""
            sctx["intro_html"] = ""
            # chronological (series order), not the newest-first default -
            # a series is meant to be read front-to-back.
            sctx["items"] = [self._card(p, lang) for p in items]
            self.render(
                "list.html",
                site.output_dir / lang_out(site, lang) / "series" / slugify(name) / "index.html",
                **sctx,
            )

    def build_rss(self, lang: str):
        site = self.site
        items = site.all_items_for_lang(lang)[:20]
        base = site.base_url.rstrip("/")
        prefix = site.lang_prefix(lang)

        entries = []
        for p in items:
            link = f"{base}{p.url}"
            pub = p.date.strftime("%a, %d %b %Y 00:00:00 +0000") if p.date else ""
            entries.append(
                f"    <item>\n"
                f"      <title>{xml_escape(p.title)}</title>\n"
                f"      <link>{xml_escape(link)}</link>\n"
                f"      <guid>{xml_escape(link)}</guid>\n"
                f"      <pubDate>{pub}</pubDate>\n"
                f"      <description>{xml_escape(p.description or excerpt(p.body_html))}</description>\n"
                f"    </item>"
            )

        rss = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<rss version="2.0"><channel>\n'
            f"  <title>{xml_escape(site.cfg.get('title',''))}</title>\n"
            f"  <link>{xml_escape(base + prefix + '/')}</link>\n"
            f"  <description>{xml_escape(site.cfg.get('description',''))}</description>\n"
            + "\n".join(entries)
            + "\n</channel></rss>\n"
        )
        out_path = site.output_dir / lang_out(site, lang) / "index.xml"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(rss, encoding="utf-8")


def lang_out(site: Site, lang: str) -> str:
    return "" if lang == site.default_lang else lang


def build(config_path: Path):
    cfg = load_config(config_path)
    site = Site(cfg)
    site.load()
    builder = Builder(site)
    builder.build_all()
    return site
