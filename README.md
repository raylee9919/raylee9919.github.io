# SSG

A small, dependency-light static site generator: Markdown + YAML front matter
+ Jinja2 templates -> static HTML. Content, static assets, and the generator
all live in this one repo.

## Setup

```
python -m pip install -r requirements.txt
```

## Usage

```
python ssg.py build              # writes to public/
python ssg.py serve              # build + serve at http://127.0.0.1:8000
python ssg.py serve --port 9000
python ssg.py new posts my-new-post --title "My New Post"
```

All commands read `site.yaml` by default (`--config path/to/other.yaml` to
override).

## How content is found

`site.yaml`'s `content_dir` points at a directory (by default `content`, in
this repo) laid out like:

```
content/
  posts/
    _index.md          # section landing page (title/description)
    _index.ko.md        # per-language variant
    my-post/
      index.md          # default-language (en) page
      index.ko.md        # Korean translation
      resources/         # images etc., copied alongside the built page
        cover.png
  projects/
    ...
```

Front matter fields read: `title`, `date`, `description`, `summary`, `tags`,
`categories`, `series`, `cover` (path relative to the bundle dir, or a
root-relative `/images/...` path into `static/`), `draft` (skips the page
when true), `link`, `status`, `weight` (optional manual sort key — lower
sorts first and beats date-based ordering entirely; leave unset and nothing
changes).

Sections are config-driven (`site.yaml`'s `sections:` map), not hard-coded —
currently `posts`, `projects`, `studies`, in that nav order, with `Tags`
always last. Add a fourth by adding it to `site.yaml` and creating
`content/<name>/_index.md`.

The first language listed in `site.yaml`'s `languages` map is served at the
site root; any others are served under `/<lang>/`. A language switch link
only appears for a language once you've written that language's `index.md`
inside a bundle — until then it falls back to that language's home page.

## What it does

- Renders Markdown (fenced code, tables, footnotes, TOC) with server-side
  Pygments syntax highlighting.
- Generates section list pages, tag pages, a home page, and an RSS feed,
  per language.
- Copies each bundle's `resources/` folder next to its built page, and merges
  `static_dirs` (e.g. `Blog/static` + this repo's `static/`) into the site root.
- KaTeX (`$..$` / `$$..$$`) is rendered client-side via a CDN script on post
  pages — needs internet access in the browser, nothing server-side to install.
- Dark/light theme toggle, persisted per-visitor via `localStorage`.
- Live WebGL2 demos, embeddable straight in a post's markdown: a raymarched
  full-screen-shader canvas (`shader-canvas.js`) and a real mesh viewer with
  a parameter panel and an in-browser code editor (`mesh-shader.js`). See
  the `webgl-raymarching` and `webgl-mesh-lab` posts for working examples,
  and [ARCHITECTURE.md](ARCHITECTURE.md#the-two-webgl-runtimes) for how they work.
- A small compatibility shim for the handful of Hugo shortcodes
  (`{{< figure >}}`, `{{< youtube >}}`, `{{< tabs >}}`) some migrated posts
  still contain — see [ARCHITECTURE.md](ARCHITECTURE.md#markdown-pipeline).

## What it deliberately doesn't do

No comments widget, analytics, mermaid diagrams, image galleries/lightbox, or
multiple color-scheme presets — the Hugo theme had all of these; add them
back only if you actually want them. Keeping this small is the point.

## Layout

```
ssg.py            CLI entry point (build / serve / new)
ssg/              the generator itself
  content.py        front-matter + markdown parsing, content discovery
  build.py           Site/Builder: URLs, rendering, static copy, RSS
  new.py              `ssg.py new` scaffolding
  server.py           local dev server
  util.py             slugify, plain-text excerpt
templates/         Jinja2 templates
static/            SSG's own css/js (merged with Blog/static at build time)
site.yaml          site configuration
public/            build output (gitignored)
```

For how it's actually programmed internally — the build pipeline, content
discovery, URL routing, the markdown/shortcode pipeline, and how the two
WebGL runtimes work — see [ARCHITECTURE.md](ARCHITECTURE.md).
