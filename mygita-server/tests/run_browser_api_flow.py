"""Run the browser API-provider vertical slice against an ephemeral Flask API."""

import os
import functools
import http.server
import shutil
import subprocess
import sys
import tempfile
import threading


SERVER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPOSITORY_ROOT = os.path.dirname(SERVER_ROOT)
if SERVER_ROOT not in sys.path:
    sys.path.insert(0, SERVER_ROOT)

from api import create_app  # noqa: E402
from werkzeug.serving import make_server  # noqa: E402


def main():
    node = shutil.which("node")
    if not node:
        raise SystemExit("node is required to run the browser API-provider flow")
    with tempfile.TemporaryDirectory() as runtime_dir:
        evidence_path = os.path.join(runtime_dir, "request-budget-evidence.jsonl")
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=REPOSITORY_ROOT)
        static_server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        static_thread = threading.Thread(target=static_server.serve_forever, daemon=True)
        static_thread.start()
        site_origin = "http://127.0.0.1:%s" % static_server.server_port
        app = create_app(
            os.path.join(SERVER_ROOT, "mock-data"),
            runtime_dir,
            "browser-api-flow-secret",
            allowed_origins={site_origin},
        )
        # Flask's test client covers WSGI behavior in the unit and OpenAPI
        # suites. This flow deliberately starts a real ephemeral HTTP server
        # because the JavaScript API providers communicate over fetch.
        server = make_server("127.0.0.1", 0, app, threaded=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        environment = dict(os.environ)
        environment["MYGITA_TEST_API_BASE_URL"] = "http://127.0.0.1:%s/api/v1" % server.server_port
        environment["MYGITA_TEST_SITE_URL"] = site_origin
        environment["MYGITA_REQUEST_BUDGET_EVIDENCE"] = evidence_path
        environment["MYGITA_TEST_CHROME"] = (
            shutil.which("google-chrome")
            or shutil.which("chromium")
            or "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        )
        test_file = os.path.join(REPOSITORY_ROOT, "mygita", "tests", "flows", "gita-sara-api-flow.integration.js")
        try:
            subprocess.run([node, "--test", test_file], cwd=REPOSITORY_ROOT, env=environment, check=True)
            browser_test = os.path.join(REPOSITORY_ROOT, "dev-tools", "scripts", "verify-data-use-browser.mjs")
            subprocess.run([node, browser_test], cwd=REPOSITORY_ROOT, env=environment, check=True)
            report_script = os.path.join(REPOSITORY_ROOT, "dev-tools", "scripts", "generate-request-budget-report.mjs")
            report_path = os.path.join(REPOSITORY_ROOT, "docs", "gitajyoti", "regions", "mygita", "request-budget-verification.md")
            subprocess.run([node, report_script, evidence_path, report_path], cwd=REPOSITORY_ROOT, env=environment, check=True)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
            static_server.shutdown()
            static_server.server_close()
            static_thread.join(timeout=2)
            app.mygita.store.close()


if __name__ == "__main__":
    main()
