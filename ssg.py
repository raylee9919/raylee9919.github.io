#!/usr/bin/env python3
"""SSG - a small static site generator.

Usage:
    python ssg.py build [--config site.yaml]
    python ssg.py serve [--port 8000] [--config site.yaml]
    python ssg.py new <section> <slug> [--title "My Title"] [--config site.yaml]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ssg.build import build, load_config
from ssg.new import new_content
from ssg.server import serve

ROOT = Path(__file__).resolve().parent


def cmd_build(args):
    site = build(Path(args.config))
    n_pages = sum(len(v) for v in site.items.values())
    print(f"Built {n_pages} content pages across {len(site.languages)} language(s) -> {site.output_dir}")


def cmd_serve(args):
    site = build(Path(args.config))
    serve(site.output_dir, port=args.port)


def cmd_new(args):
    cfg = load_config(Path(args.config))
    from ssg.build import _resolve
    content_dir = _resolve(cfg["_root"], cfg["content_dir"])
    languages = list(cfg.get("languages", {}).keys())
    bundle_dir, created = new_content(content_dir, args.section, args.slug, languages, args.title)
    print(f"Created {bundle_dir}")
    for p in created:
        print(f"  {p}")


def main():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--config", default=str(ROOT / "site.yaml"))

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_build = sub.add_parser("build", help="Build the static site", parents=[common])
    p_build.set_defaults(func=cmd_build)

    p_serve = sub.add_parser("serve", help="Build and serve the site locally", parents=[common])
    p_serve.add_argument("--port", type=int, default=8000)
    p_serve.set_defaults(func=cmd_serve)

    p_new = sub.add_parser("new", help="Scaffold a new content bundle", parents=[common])
    p_new.add_argument("section", help="e.g. posts, projects")
    p_new.add_argument("slug", help="URL slug / directory name, e.g. my-new-post")
    p_new.add_argument("--title", default=None)
    p_new.set_defaults(func=cmd_new)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
