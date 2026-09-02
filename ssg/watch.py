"""A tiny dependency-free file watcher for `ssg.py serve`.

Polls mtimes under a set of root paths rather than using a filesystem-events
library (e.g. watchdog) - one less dependency to install, and a dev server
doesn't need sub-second reaction time.
"""

from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Callable, Iterable


def _snapshot(paths: Iterable[Path]) -> dict[str, float]:
    """path -> mtime for every file under the given roots (a root may itself
    be a single file, e.g. site.yaml)."""
    snap: dict[str, float] = {}
    for root in paths:
        if not root.exists():
            continue
        if root.is_file():
            snap[str(root)] = root.stat().st_mtime
            continue
        for entry in root.rglob("*"):
            if entry.is_file():
                try:
                    snap[str(entry)] = entry.stat().st_mtime
                except OSError:
                    pass  # e.g. an editor swap file that vanished mid-scan
    return snap


def watch(
    paths: list[Path],
    on_change: Callable[[], None],
    interval: float = 0.75,
    stop_event: threading.Event | None = None,
) -> None:
    """Block, polling `paths` every `interval` seconds, calling `on_change()`
    whenever a file under them is added, removed, or modified. Returns once
    `stop_event` is set."""
    stop_event = stop_event or threading.Event()
    last = _snapshot(paths)
    while not stop_event.wait(interval):
        current = _snapshot(paths)
        if current != last:
            last = current
            on_change()
