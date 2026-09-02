from __future__ import annotations

import functools
import http.server
import threading
from pathlib import Path
from typing import Callable

from .watch import watch


def serve(
    directory: Path,
    port: int = 8000,
    watch_paths: list[Path] | None = None,
    rebuild: Callable[[], None] | None = None,
):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)

    stop_event = threading.Event()
    watcher_thread = None
    if watch_paths and rebuild:
        def on_change():
            print("Change detected, rebuilding...")
            try:
                rebuild()
                print("Rebuilt.")
            except Exception as e:
                print(f"Rebuild failed: {e}")

        watcher_thread = threading.Thread(
            target=watch, args=(watch_paths, on_change), kwargs={"stop_event": stop_event}, daemon=True,
        )
        watcher_thread.start()
        print("Watching for changes (content, templates, static, config)...")

    print(f"Serving {directory} at http://127.0.0.1:{port}/  (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        stop_event.set()
        httpd.server_close()
