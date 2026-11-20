"""Serve the website locally and allow the MyGita app to import its invitation module."""

import argparse
from html import escape
from io import BytesIO
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class WebsiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, mygita_url, **kwargs):
        self.mygita_url = mygita_url
        super().__init__(*args, **kwargs)

    def send_head(self):
        if self.mygita_url and urlsplit(self.path).path == "/register.html":
            page = (Path(self.directory) / "register.html").read_text(encoding="utf-8")
            original = 'href="https://mygita.gitajyoti.org/"'
            if page.count(original) != 1:
                self.send_error(500, "Expected one MyGita destination in register.html")
                return None
            page = page.replace(original, f'href="{escape(self.mygita_url)}"').encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(page)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return BytesIO(page)
        return super().send_head()

    def end_headers(self):
        if self.mygita_url and urlsplit(self.path).path == "/assets/js/mygita-invite-handler/v2/index.js":
            app = urlsplit(self.mygita_url)
            origin = f"{app.scheme}://{app.netloc}"
            self.send_header("Vary", "Origin")
            if self.headers.get("Origin") == origin:
                self.send_header("Access-Control-Allow-Origin", origin)
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--mygita-url", help="MyGita app URL for local registration")
    args = parser.parse_args()
    if args.mygita_url:
        try:
            app = urlsplit(args.mygita_url)
            if app.scheme not in ("http", "https") or not app.hostname or app.username is not None:
                raise ValueError("expected an absolute HTTP or HTTPS app URL")
            port = app.port
            host = f"[{app.hostname}]" if ":" in app.hostname else app.hostname
            if port is not None and port != {"http": 80, "https": 443}[app.scheme]:
                host += f":{port}"
            args.mygita_url = app._replace(netloc=host).geturl()
        except ValueError as error:
            parser.error(f"invalid --mygita-url: {error}")
    root = Path(__file__).resolve().parents[2]
    handler = partial(WebsiteHandler, directory=str(root), mygita_url=args.mygita_url)
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Serving Gita Jyoti at http://127.0.0.1:{server.server_port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
