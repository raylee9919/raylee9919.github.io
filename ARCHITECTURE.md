# How SSG is built

This documents the generator's internals — what runs when you call
`ssg.py build`, how content is discovered and turned into pages, and how the
two WebGL runtimes work. For usage (commands, front matter fields), see
[README.md](README.md).

## Philosophy

Every other file in this repo exists to avoid one of these:
a config language, a plugin system, a theme abstraction, a JS build step.
Sections are just directories. Languages are just file suffixes. A shader
demo is a `<div>` a small script mounts. When something needed solving twice
(the raymarch canvas and the mesh canvas share a toolbar/pause-clock shape,
the mesh's `<details>`-from-`{{< tabs >}}` reuses the site's own `<details>`
styling) it was solved the same way both times rather than abstracted early.
The [README](README.md#what-it-deliberately-doesnt-do) lists what got left
out on purpose — most of it because "just edit the template/CSS/JS directly"
was cheaper than a config knob for it.

## Directory layout

```
ssg.py            CLI entry point (build / serve / new) - argparse, thin
ssg/
  content.py         front matter + markdown parsing, shortcode shim, content discovery
  build.py            Site (URLs, sorting) + Builder (rendering, static copy, RSS)
  new.py               `ssg.py new` scaffolding
  server.py            stdlib http.server wrapper for local preview
  util.py              slugify(), excerpt()
templates/          Jinja2 templates (base/home/list/single/tags_index/_card)
static/             this repo's own css/js - merged with Blog/static at build time
site.yaml           site configuration (see README)
public/             build output (gitignored, fully regenerated each build)
```

Content lives in this same repo, at `content/` (configurable via `site.yaml`'s
`content_dir` — it was originally read from a separate `Blog/` checkout while
this generator was being built against real content without disturbing the
live Hugo site; that's over, everything's here now). Nothing here assumes
content is Hugo-flavored except the shortcode compatibility shim described
below, which exists purely because some pages were originally written for
Hugo and still contain its syntax.

## The build pipeline

`ssg.build.build(config_path)` does, in order:

1. **`load_config`** — reads `site.yaml`, stashes its parent directory as
   `cfg["_root"]` so every other path in the file (content_dir, static_dirs,
   output_dir) resolves relative to *the config file*, not the current
   working directory.
2. **`Site(cfg)`** — a thin holder for resolved paths, language list, and
   URL-building methods. `Site.load()` walks every configured section and
   fills `self.items` / `self.list_pages`.
3. **`Builder(site)`** — owns the Jinja2 `Environment` and does the actual
   rendering: `build_all()` clears `public/`, copies static assets, writes
   the Pygments stylesheet, then for each language builds the home page,
   each section's list + item pages, the tag pages, and an RSS feed.

Nothing is incremental — every build is a full rebuild from scratch
(`shutil.rmtree(public/)` first). At this content size that's sub-second, so
there's no cache to invalidate and no stale-output class of bug to worry
about. (`_rmtree_retry` exists only because Windows' indexer/AV can hold a
transient lock on a just-written file right after a build — it retries a
few times before giving up, not a caching mechanism.)

## Content discovery (`content.py`)

A **bundle** is a directory holding one `index.<lang>.md` per language it's
translated into (the default language's file is just `index.md`, no suffix).
`discover_bundle()` scans a directory once and returns `{lang: (meta, body)}`
for whichever files exist — a bundle with only `index.md` simply has no
`ko` entry, and the site quietly falls back to linking that language's home
page instead (see `Builder.base_context`'s `lang_urls`).

`load_section(content_dir, section, languages, default_lang)` is the whole
of content discovery: it reads the section directory's `_index.<lang>.md`
files (the list-page metadata: title/description for `/posts/`, etc.), then
iterates every subdirectory as a bundle. Each language variant becomes a
`Page` — front matter parsed from YAML, body rendered to HTML immediately
(so `Page.body_html` is ready-to-embed by the time the builder touches it).
Drafts (`draft: true`) are filtered out here, at discovery time, so they
never reach a template.

Every configured section (`site.yaml`'s `sections:` map) is loaded through
this exact same function — `posts`, `projects`, and `studies` are not
special-cased anywhere in the code. Adding a fourth section is: add it to
`site.yaml`, create `content/<name>/_index.md`, done.

### `Page` (a dataclass, not a template context)

`section`, `slug`, `lang`, `is_list`, `meta` (raw front matter dict),
`body_html`, `toc` (from the `toc` markdown extension), `source_dir` (for
resource-copying), and `url` (filled in later by `Site.url_for`, once every
page exists and cross-linking is possible). `title`/`date`/`draft`/`tags`/
`categories`/`description`/`cover`/`weight` are properties reading out of
`meta` with sensible fallbacks — front matter has no schema beyond what
these properties happen to look for, so an unrecognized field is simply
ignored rather than rejected.

`Page.sort_key()` is what list pages, the home page's "recent," and tag
pages all sort by: pages with a `weight:` in front matter sort first, by
ascending weight; everything else falls back to date, newest first. A
weight of `1` always beats a weight of `2` regardless of either page's date;
an unweighted page never outranks a weighted one. This is the entirety of
the "pin things in an order I choose" mechanism — there's no separate
ordering config, just that one property read at sort time.

## Markdown pipeline

`render_markdown(body)` in `content.py`:

1. `preprocess_shortcodes(body)` — a line-scanning pass, **before** markdown
   conversion, that expands the handful of Hugo shortcodes some pages still
   contain: `{{< figure src=".." attr=".." width="..">}}` → a real
   `<figure>`, `{{< youtube ID >}}` → a responsive iframe embed,
   `{{< icon name="..">}}` → dropped (it was always paired with a markdown
   link right after it, so the link alone carries the same information —
   this site doesn't use an icon font anywhere), and `{{< tabs >}}` /
   `{{< tab label="..">}}` / `{{< /tab >}}` / `{{< /tabs >}}` → a
   `<div class="md-tabs">` of `<details class="md-tab" markdown="1">`
   elements (first one `open`), reusing the site's own collapsible-section
   styling instead of shipping a separate tab widget. This is *not* a
   general shortcode engine — it's a fixed, small regex table matched to
   exactly what the migrated content uses. A shortcode it doesn't recognize
   passes through unchanged (and will show up literally in the page, which
   is your signal to add a case for it here if it ever happens).
2. `python-markdown` conversion, with `fenced_code`, `codehilite` (Pygments,
   `github-dark` style, written once per build to `public/css/highlight.css`
   — see `Builder.write_highlight_css`), `tables`, `toc`, `footnotes`,
   `attr_list`, `sane_lists`, and `md_in_html`.

`md_in_html` matters more than it looks: by default, markdown syntax
*inside* a raw HTML block (like a hand-written `<details>…</details>`) is
left completely alone — no bold, no links, no code fences. Content authored
for Hugo's Goldmark renderer (which processes markdown inside HTML blocks by
default) relied on that working. The fix, and the reason a few `<details>`
tags in the actual content say `<details markdown="1">`, is that
`md_in_html` only processes inner markdown when the tag explicitly opts in
via `markdown="1"`. Any new hand-written HTML block that should contain
markdown needs that attribute — the raymarch/mesh shader embeds (`<div
class="shader-embed">…<script>…</script>…</div>`) deliberately *don't* set
it, because their content is GLSL/JS, not markdown, and leaving it out keeps
it byte-for-byte untouched by the parser.

## URL routing (`Site` in `build.py`)

Every URL is root-relative and built from three primitives:

- `lang_prefix(lang)` — `""` for the default language, `"/<lang>"` otherwise.
- a page's own `section` + `slug` (or nothing, for the home page / list pages).
- a trailing slash, always (pretty URLs, `index.html` inside each directory).

So `url_for(page)` is just `f"{prefix}/{section}/{slug}/"`, and list pages,
the tag index, individual tag pages, and the home page each have their own
one-line builder method following the same shape. `cover_url(page)` is the
one exception with a branch: a `cover:` starting with `/` or `http(s)://` is
used as-is (it's pointing at `static/`, or somewhere external); anything
else is treated as relative to the *bundle's own* resources and joined onto
the page's URL, since that's where `_copy_resources` puts the bundle's
`resources/` folder at build time.

## Templating (`templates/*.html`, Jinja2)

`Builder.base_context(lang, active_url, lang_urls)` builds the context every
template shares: site metadata, the author block (language-suffixed fields
like `title_ko` fall back to the unsuffixed one), the nav list (built from
`site.yaml`'s `sections:` — dict order is preserved, so nav order is exactly
config order, with Tags hard-coded as the last item in `base.html` rather
than a config entry), and `lang_urls` — a `{lang: url}` map the language
switcher renders directly. That map defaults every language to its home
page and is overridden with real per-page translations where they exist
(`Site.alt_urls`) or a section's own translated list page — so the switcher
never has to show a dead link, it just falls back to "that language's home"
when a specific translation doesn't exist yet.

Five templates, no inheritance beyond `{% extends "base.html" %}`:
`home.html`, `list.html` (used for section indexes *and* tag pages — same
shape, a title/intro/grid of cards), `single.html` (a post/project/study
page), `tags_index.html`, and `_card.html` (included by both `home.html`
and `list.html` for the post/project grid — the one bit of template reuse
in the whole project, because writing the same five fields twice was the
first duplication that actually hurt).

## Static assets & resources

`static_dirs` in `site.yaml` (`Blog/static` and this repo's own `static/`)
are copied into `public/` wholesale, in list order, so a later entry can
overwrite an earlier one by filename — this repo's `static/` is listed last
so its `css`/`js` win if `Blog/static` ever grows same-named files. Each
content bundle's own `resources/` folder is copied separately, alongside
that specific page's `index.html`, by `Builder._copy_resources` — so an
image referenced as `resources/cover.png` inside a post's markdown resolves
correctly with zero path-rewriting, because the browser resolves it relative
to the page it's sitting on and that's exactly where the build put it.

## The two WebGL runtimes

Both live in `static/js/`, both are dependency-free (no bundler, no npm),
and both are additive — mounting is opt-in via a CSS class the markdown
author writes (`<div class="shader-embed">` / `<div class="mesh-shader-embed"
data-obj="...">`), scanned for and mounted once, on `DOMContentLoaded`,
per page.

**`shader-canvas.js`** — one full-screen triangle, your fragment shader.
Compiles a fixed vertex shader plus whatever GLSL sits in the embed's
`<script type="x-shader/x-fragment">`, prefixed with a prelude declaring
`iResolution` / `iTime` / `iMouse` / `fragColor` (Shadertoy's uniform
convention, not Shadertoy's runtime). `iMouse.xy` is the last pointer
position in canvas pixels; `.z` is 1.0 while the primary button is held;
`.w` is *eased* toward 1 while hovering and back to 0 on leave (an
exponential approach, `hoverBlend += (target - hoverBlend) * 0.08` each
frame) rather than a hard 0/1 flag, specifically so a shader can `mix()` a
hover-driven effect in without it popping. A small always-visible toolbar
(pause/resume, restart, elapsed time, fullscreen) is injected into a
`.shader-canvas-wrap` the script creates around the author's `<canvas>` —
no extra markup needed. Pausing doesn't stop the clock and freeze the
draw call; it accumulates paused duration (`totalPausedMs`) and subtracts
it from wall-clock time every frame, so `iTime` is exactly where it was
when resumed, not wherever `performance.now()` has since drifted to.

**`mesh-shader.js`** — the same toolbar and pause-clock, over a real
rasterization pipeline instead of a full-screen triangle: a tiny OBJ parser
(`v`/`vn`/`f`, fan-triangulating anything with more than 3 vertices per
face) builds an interleaved position+normal vertex buffer, drawn through a
**fixed** vertex shader (not user-editable — see below) and a **user-editable**
fragment shader. Camera is a from-scratch orbit rig (hand-rolled column-major
`perspective()`/`lookAt()`, no matrix library): drag to orbit (yaw/pitch),
wheel to dolly, a slow constant auto-yaw when the pointer isn't down.

Two things specific to this file:

- **The `// @param NAME kind ...args` pragma** is this project's own
  convention, not GLSL and not a real Hugo/Shadertoy feature — a comment
  line, re-parsed on every recompile, that simultaneously declares a
  uniform (spliced in above the author's code automatically — the author
  never writes the `uniform` line) and generates its control: `color r g b`
  → a color swatch bound to a `vec3`, `slider min max default` → a range
  input bound to a `float`, `toggle 0|1` → a checkbox bound to a `float`
  (`0.0`/`1.0`, sidestepping GLSL bool-uniform quirks entirely). Dragging a
  control only issues a `gl.uniform*` call in the existing render loop — it
  never recompiles. Editing which `@param` lines exist does require a
  recompile (Run / Ctrl+Enter), at which point `applyProgram` diffs the new
  parameter list against the old one by `(kind, name)` and carries forward
  any value whose key still matches, so reshaping the shader around a
  slider doesn't reset it.
- **The vertex stage is fixed on purpose.** Only the fragment shader is
  user-editable. Live-patching the vertex stage means live-patching which
  attributes exist and how the pipeline is wired — a much easier way to end
  up staring at a black canvas than a fragment shader's math ever is. A
  failed recompile (either stage, though in practice only ever the
  fragment shader) shows the GLSL compiler's real error message in the
  editor panel and **keeps the previous, still-linked program bound** —
  nothing here goes to a blank canvas because of a typo.

## CLI (`ssg.py`)

Three subcommands, all sharing a `--config` flag (defaults to this repo's
`site.yaml`): `build` (just calls `ssg.build.build`), `serve` (build, then
`ssg.server.serve(site.output_dir)` — a `ThreadingHTTPServer` over
`http.server.SimpleHTTPRequestHandler`, nothing custom), and `new` (calls
`ssg.new.new_content` to scaffold a bundle directory with per-language front
matter stubs, `draft: true` by default). None of this talks to git, GitHub
Pages, or the `Blog` repo's Hugo Actions workflow — this generator and that
deploy pipeline are currently unconnected on purpose (see the README's
[cutover note](README.md)).

## Known sharp edges

- **Full rebuild, not a dev-server with hot reload.** `serve` builds once,
  then serves statically; editing content means re-running `serve`, not
  seeing it update live.
- **The shortcode shim is a fixed table, not a shortcode engine.** A Hugo
  shortcode this content doesn't already use will pass through literally
  as text if you paste it into a new post.
- **No image processing.** Whatever's in `resources/` is copied byte-for-
  byte — no resizing, no format conversion, no `srcset`. Hugo did this;
  this doesn't.
- **`weight` is the only manual-ordering mechanism**, and it's global
  within whatever list a page appears in — there's no per-page "pin to top
  of home but not of its section" distinction.
