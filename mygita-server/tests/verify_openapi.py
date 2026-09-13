"""Exercise every mock API operation and validate its payload against OpenAPI."""

import json
import os
import shutil
import subprocess
import sys
import tempfile


SERVER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPOSITORY_ROOT = os.path.dirname(SERVER_ROOT)
if SERVER_ROOT not in sys.path:
    sys.path.insert(0, SERVER_ROOT)

from api.app import API_PREFIX  # noqa: E402
from api import create_app  # noqa: E402
from api.storage import JsonStore  # noqa: E402


def main():
    node = shutil.which("node")
    if not node:
        raise SystemExit("node is required to validate captured API responses")

    captures = []
    with tempfile.TemporaryDirectory() as runtime_dir:
        seed_dir = os.path.join(SERVER_ROOT, "mock-data")
        store = JsonStore(seed_dir, runtime_dir)
        app = create_app(seed_dir, runtime_dir, "openapi-contract-test-secret", now=lambda: 1788000000, store=store)
        client = app.test_client()

        def request(method, path, body=None, token=None):
            headers = {"Authorization": "Bearer " + token} if token else {}
            request_path = API_PREFIX if path == "/" else API_PREFIX + path
            kwargs = {"headers": headers, "environ_overrides": {"REMOTE_ADDR": "127.0.0.1"}}
            if body is not None:
                kwargs["json"] = body
            response = client.open(request_path, method=method, **kwargs)
            status, payload = response.status_code, response.get_json()
            captures.append({"method": method, "path": path, "status": status, "body": payload})
            return status, payload

        request("GET", "/")
        request("GET", "/health")
        request("GET", "/experiences")
        request("GET", "/experiences/exp-gita-sara")
        request("GET", "/experiences/gita-sara/batches")
        request("GET", "/me")  # Exercise the real error envelope.

        # Data-use optimization (contract v0.3): 200 responses only -- the
        # unit suite (tests/test_api.py) already covers each endpoint's 304
        # path with dedicated behavioral assertions, and a 304 has no JSON
        # body for this script's schema validation to check anyway.
        request("GET", "/experience-catalogue/manifest")
        request("GET", "/experience-catalogue/summaries")

        _, challenge = request("POST", "/auth/otp/request", {"countryCode": "+91", "mobile": "9876543210"})
        _, session = request("POST", "/auth/otp/verify", {"challengeId": challenge["challengeId"], "otp": "123456"})
        token = session["accessToken"]

        request("GET", "/me", token=token)
        request("PATCH", "/me", {"preferredLanguage": "English", "city": "Bengaluru"}, token)
        request(
            "PATCH",
            "/me/onboarding",
            {"fullName": "Vijay Sharma", "displayName": "Vijay", "dateOfBirth": "1985-05-12"},
            token,
        )
        request("GET", "/me/journey", token=token)
        _, journey = request(
            "POST",
            "/me/journey",
            {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"},
            token,
        )
        request("POST", "/me/interests", {"experienceId": "exp-purna-yoga"}, token)
        activity_id = journey["nextActivity"]["id"]
        request("GET", "/me/activities/" + activity_id, token=token)
        request("GET", "/me/manifest", token=token)
        request("POST", "/me/activities/" + activity_id + "/complete", {}, token)

        # Data-use optimization Phase 5 prerequisite (contract v0.4): 200
        # responses only, same reasoning as the Phase 2 manifests above --
        # tests/test_api.py already covers each endpoint's 304 path.
        request("GET", "/me/journeys", token=token)
        request("GET", "/me/interests", token=token)
        request("GET", "/me/activity-state", token=token)

        _, password_session = request(
            "POST",
            "/auth/accounts",
            {"username": "asha.verma", "password": "a long memorable passphrase"},
        )
        password_token = password_session["accessToken"]
        request("GET", "/me", token=password_token)
        request(
            "POST",
            "/auth/password/login",
            {"username": "Asha.Verma", "password": "a long memorable passphrase"},
        )

        request("POST", "/dev/reset", {})

        capture_path = os.path.join(runtime_dir, "openapi-responses.json")
        with open(capture_path, "w", encoding="utf-8") as handle:
            json.dump(captures, handle)

        validator = os.path.join(REPOSITORY_ROOT, "dev-tools", "scripts", "validate-openapi.mjs")
        subprocess.run([node, validator, "--responses", capture_path], check=True)


if __name__ == "__main__":
    main()
