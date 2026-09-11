import json
import os
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen


SERVER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_ROOT not in sys.path:
    sys.path.insert(0, SERVER_ROOT)

from api import create_server  # noqa: E402
from api.storage import JsonStore  # noqa: E402


class ApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.current_time = [1788000000]
        cls.seed_dir = os.path.join(SERVER_ROOT, "mock-data")
        cls.server = create_server(
            "127.0.0.1",
            0,
            cls.seed_dir,
            cls.temporary.name,
            "test-secret",
            allowed_origins={"http://localhost:8000"},
            now=lambda: cls.current_time[0],
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:%s/api/v1" % cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        cls.temporary.cleanup()

    def setUp(self):
        self.request("POST", "/dev/reset", {})
        self.current_time[0] = 1788000000

    def request(self, method, path, body=None, token=None, origin=None):
        headers = {}
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = "Bearer " + token
        if origin:
            headers["Origin"] = origin
        request = Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urlopen(request) as response:
                return response.status, json.loads(response.read()), response.headers
        except HTTPError as error:
            return error.code, json.loads(error.read()), error.headers

    def register(self, mobile="9876543210", complete=True):
        status, payload, _ = self.request("POST", "/auth/otp/request", {"countryCode": "+91", "mobile": mobile})
        self.assertEqual(status, 201)
        status, verified, _ = self.request("POST", "/auth/otp/verify", {"challengeId": payload["challengeId"], "otp": "123456"})
        self.assertEqual(status, 200)
        token = verified["accessToken"]
        if complete:
            status, _, _ = self.request("PATCH", "/me/onboarding", {"fullName": "Vijay Sharma", "displayName": "Vijay", "dateOfBirth": "1985-05-12"}, token)
            self.assertEqual(status, 200)
        return token, verified

    def test_health_catalogue_and_cors(self):
        status, api_index, _ = self.request("GET", "")
        self.assertEqual((status, api_index["status"], api_index["version"]), (200, "ok", "1"))
        self.assertEqual(api_index["links"]["experiences"], "/api/v1/experiences")
        status, health, _ = self.request("GET", "/health")
        self.assertEqual((status, health["status"]), (200, "ok"))
        status, catalogue, headers = self.request("GET", "/experiences", origin="http://localhost:8000")
        self.assertEqual(status, 200)
        self.assertEqual(len(catalogue["items"]), 4)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "http://localhost:8000")

    def test_invalid_mobile_and_otp(self):
        status, payload, _ = self.request("POST", "/auth/otp/request", {"mobile": "123"})
        self.assertEqual((status, payload["error"]["code"]), (422, "invalid_mobile"))
        _, challenge, _ = self.request("POST", "/auth/otp/request", {"mobile": "9876543210"})
        status, payload, _ = self.request("POST", "/auth/otp/verify", {"challengeId": challenge["challengeId"], "otp": "000000"})
        self.assertEqual((status, payload["error"]["code"]), (401, "incorrect_otp"))

    def test_registration_existing_user_and_onboarding(self):
        token, first = self.register(complete=False)
        self.assertTrue(first["isNewUser"])
        status, payload, _ = self.request("GET", "/me/journey", token=token)
        self.assertEqual((status, payload["error"]["code"]), (403, "onboarding_required"))
        status, user, _ = self.request("PATCH", "/me/onboarding", {"fullName": "Vijay Sharma", "displayName": "Vijay", "dateOfBirth": "1985-05-12"}, token)
        self.assertEqual(user["onboarding"]["state"], "complete")
        _, second_challenge, _ = self.request("POST", "/auth/otp/request", {"mobile": "9876543210"})
        status, second, _ = self.request("POST", "/auth/otp/verify", {"challengeId": second_challenge["challengeId"], "otp": "123456"})
        self.assertFalse(second["isNewUser"])
        self.assertEqual(first["user"]["id"], second["user"]["id"])

    def test_token_required_and_expiry(self):
        status, payload, _ = self.request("GET", "/me")
        self.assertEqual((status, payload["error"]["code"]), (401, "authentication_required"))
        token, _ = self.register()
        self.current_time[0] += 28801
        status, payload, _ = self.request("GET", "/me", token=token)
        self.assertEqual((status, payload["error"]["code"]), (401, "invalid_token"))

    def test_enrolment_journey_activity_and_duplicate(self):
        token, _ = self.register()
        status, journey, _ = self.request("POST", "/me/journey", {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"}, token)
        self.assertEqual(status, 201)
        self.assertEqual(journey["progress"], {"completed": 0, "total": 3})
        activity_id = journey["nextActivity"]["id"]
        status, activity, _ = self.request("GET", "/me/activities/" + activity_id, token=token)
        self.assertEqual((status, activity["completed"]), (200, False))
        status, updated, _ = self.request("POST", "/me/activities/" + activity_id + "/complete", {}, token)
        self.assertEqual(updated["progress"]["completed"], 1)
        status, payload, _ = self.request("POST", "/me/journey", {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"}, token)
        self.assertEqual((status, payload["error"]["code"]), (409, "duplicate_enrolment"))

    def test_interest_and_reset(self):
        token, _ = self.register()
        status, interest, _ = self.request("POST", "/me/interests", {"experienceId": "exp-purna-yoga"}, token)
        self.assertEqual(status, 201)
        self.assertEqual(interest["experienceId"], "exp-purna-yoga")
        self.request("POST", "/dev/reset", {})
        status, payload, _ = self.request("GET", "/me", token=token)
        self.assertEqual((status, payload["error"]["code"]), (401, "invalid_user"))

    def test_runtime_state_survives_store_reload(self):
        self.register()
        reloaded = JsonStore(self.seed_dir, self.temporary.name)
        self.assertEqual(len(reloaded.list_users()), 1)


if __name__ == "__main__":
    unittest.main()
