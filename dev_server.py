"""Local dev server for docs/ that disables all caching, so the preview
always reflects the latest files on disk (no stale browser cache)."""
import http.server
import functools


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    import os
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    docs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs")
    handler = functools.partial(NoCacheHandler, directory=docs_dir)
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
