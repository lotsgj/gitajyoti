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

from api.app import API_PREFIX, ApiProblem, MyGitaApplication  # noqa: E402


def main():
    node = shutil.which("node")
    if not node:
        raise SystemExit("node is required to validate captured API responses")

    captures = []
    with tempfile.TemporaryDirectory() as runtime_dir:
        application = MyGitaApplication(
            os.path.join(SERVER_ROOT, "mock-data"),
            runtime_dir,
            "openapi-contract-test-secret",
            now=lambda: 1788000000,
        )

        def request(method, path, body=None, token=None):
            headers = {"Authorization": "Bearer " + token} if token else {}
            dispatch_path = API_PREFIX if path == "/" else API_PREFIX + path
            try:
                status, payload = application.dispatch(method, dispatch_path, body or {}, headers)
            except ApiProblem as problem:
                status = problem.status
                payload = {"error": {"code": problem.code, "message": problem.message}}
                if problem.details is not None:
                    payload["error"]["details"] = problem.details
            captures.append({"method": method, "path": path, "status": status, "body": payload})
            return status, payload

        request("GET", "/")
        request("GET", "/health")
        request("GET", "/experiences")
        request("GET", "/experiences/exp-gita-sara")
        request("GET", "/experiences/gita-sara/batches")
        request("GET", "/me")  # Exercise the real error envelope.

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
        request("POST", "/me/activities/" + activity_id + "/complete", {}, token)
        request("POST", "/dev/reset", {})

        capture_path = os.path.join(runtime_dir, "openapi-responses.json")
        with open(capture_path, "w", encoding="utf-8") as handle:
            json.dump(captures, handle)

        validator = os.path.join(REPOSITORY_ROOT, "dev-tools", "scripts", "validate-openapi.mjs")
        subprocess.run([node, validator, "--responses", capture_path], check=True)


if __name__ == "__main__":
    main()
