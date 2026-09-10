"""Run the browser API-provider vertical slice against an ephemeral mock API."""

import os
import shutil
import subprocess
import sys
import tempfile
import threading


SERVER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPOSITORY_ROOT = os.path.dirname(SERVER_ROOT)
if SERVER_ROOT not in sys.path:
    sys.path.insert(0, SERVER_ROOT)

from api import create_server  # noqa: E402


def main():
    node = shutil.which("node")
    if not node:
        raise SystemExit("node is required to run the browser API-provider flow")
    with tempfile.TemporaryDirectory() as runtime_dir:
        server = create_server(
            "127.0.0.1",
            0,
            os.path.join(SERVER_ROOT, "mock-data"),
            runtime_dir,
            "browser-api-flow-secret",
        )
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        environment = dict(os.environ)
        environment["MYGITA_TEST_API_BASE_URL"] = "http://127.0.0.1:%s/api/v1" % server.server_port
        test_file = os.path.join(REPOSITORY_ROOT, "mygita", "tests", "flows", "gita-sara-api-flow.integration.js")
        try:
            subprocess.run([node, "--test", test_file], cwd=REPOSITORY_ROOT, env=environment, check=True)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    main()
