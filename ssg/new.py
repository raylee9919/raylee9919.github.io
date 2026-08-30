from __future__ import annotations

import datetime
from pathlib import Path

TEMPLATES = {
    "en": """---
title: "{title}"
date: {date}
description: ""
tags: []
categories: []
series: []
cover: ""
draft: true
---

Write here.
""",
    "ko": """---
title: "{title}"
date: {date}
description: ""
tags: []
categories: []
series: []
cover: ""
draft: true
---

여기에 작성하세요.
""",
}


def new_content(content_dir: Path, section: str, slug: str, languages: list[str], title: str | None = None):
    bundle_dir = content_dir / section / slug
    bundle_dir.mkdir(parents=True, exist_ok=True)
    (bundle_dir / "resources").mkdir(exist_ok=True)
    date = datetime.date.today().isoformat()
    title = title or slug.replace("-", " ").title()

    created = []
    for i, lang in enumerate(languages):
        filename = "index.md" if i == 0 else f"index.{lang}.md"
        path = bundle_dir / filename
        if path.exists():
            continue
        tmpl = TEMPLATES.get(lang, TEMPLATES["en"])
        path.write_text(tmpl.format(title=title, date=date), encoding="utf-8")
        created.append(path)
    return bundle_dir, created
