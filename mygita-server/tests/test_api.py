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
from api.sqlite_store import SqliteStore  # noqa: E402


class ApiTestCase(unittest.TestCase):
    """Shared behavioral tests for every `Store` implementation (per
    ADR-0009: "every store implementation needs shared behavioral tests for
    query results, mutation semantics, isolation, and failure behavior").
    Not run directly -- see the `JsonStoreApiTestCase`/`SqliteStoreApiTestCase`
    subclasses at the bottom, which only supply `make_store`. Every test
    method here runs once per concrete subclass, against a real HTTP server
    backed by that subclass's store."""

    @classmethod
    def make_store(cls, seed_dir, runtime_dir):
        raise NotImplementedError("subclasses must implement make_store")

    @classmethod
    def setUpClass(cls):
        if cls is ApiTestCase:
            raise unittest.SkipTest("base class: run a concrete Store subclass instead")
        cls.temporary = tempfile.TemporaryDirectory()
        cls.current_time = [1788000000]
        cls.seed_dir = os.path.join(SERVER_ROOT, "mock-data")
        cls.store = cls.make_store(cls.seed_dir, cls.temporary.name)
        cls.server = create_server(
            "127.0.0.1",
            0,
            cls.seed_dir,
            cls.temporary.name,
            "test-secret",
            allowed_origins={"http://localhost:8000"},
            now=lambda: cls.current_time[0],
            store=cls.store,
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:%s/api/v1" % cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        if cls is ApiTestCase:
            return
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        cls.store.close()
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
        # Profile completion is not an authorization gate (ADR-0010): a
        # pending Profile can still read Journey state.
        status, payload, _ = self.request("GET", "/me/journey", token=token)
        self.assertEqual((status, payload), (200, {"items": [], "interests": []}))
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
        reloaded = self.make_store(self.seed_dir, self.temporary.name)
        try:
            self.assertEqual(len(reloaded.list_users()), 1)
        finally:
            reloaded.close()

    def create_password_account(self, username="vijay.sharma", password="a long memorable passphrase"):
        status, payload, _ = self.request("POST", "/auth/accounts", {"username": username, "password": password})
        return status, payload

    def test_password_account_creation_and_login(self):
        status, created = self.create_password_account()
        self.assertEqual(status, 201)
        self.assertTrue(created["isNewUser"])
        self.assertEqual(created["user"]["onboarding"]["state"], "pending")
        self.assertEqual(created["user"]["personalDetails"]["mobile"], "")
        token = created["accessToken"]

        status, logged_in, _ = self.request(
            "POST", "/auth/password/login", {"username": "vijay.sharma", "password": "a long memorable passphrase"}
        )
        self.assertEqual(status, 200)
        self.assertFalse(logged_in["isNewUser"])
        self.assertEqual(logged_in["user"]["id"], created["user"]["id"])

        status, onboarded, _ = self.request(
            "PATCH",
            "/me/onboarding",
            {"fullName": "Vijay Sharma", "displayName": "Vijay", "dateOfBirth": "1985-05-12"},
            token,
        )
        self.assertEqual((status, onboarded["onboarding"]["state"]), (200, "complete"))

        # An Account authenticated by password reaches the existing Journey
        # feature completely unchanged -- proof that find_user/update_user
        # resolve Account-backed and legacy OTP users transparently.
        status, journey, _ = self.request(
            "POST",
            "/me/journey",
            {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"},
            token,
        )
        self.assertEqual(status, 201)
        self.assertEqual(journey["progress"], {"completed": 0, "total": 3})

    def test_password_account_optional_profile_behavior(self):
        # ADR-0010: Profile setup is optional after Account creation. A
        # pending Profile must still be able to discover, register
        # interest, enrol, and participate in a Journey.
        status, created = self.create_password_account(username="pending.profile")
        self.assertEqual(status, 201)
        self.assertEqual(created["user"]["onboarding"]["state"], "pending")
        token = created["accessToken"]

        status, journey, _ = self.request(
            "POST",
            "/me/journey",
            {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"},
            token,
        )
        self.assertEqual(status, 201)
        activity_id = journey["nextActivity"]["id"]
        status, updated, _ = self.request("POST", "/me/activities/" + activity_id + "/complete", {}, token)
        self.assertEqual((status, updated["progress"]["completed"]), (200, 1))

        status, interest, _ = self.request("POST", "/me/interests", {"experienceId": "exp-purna-yoga"}, token)
        self.assertEqual(status, 201)

        # Still pending -- none of the above required completing it.
        status, me, _ = self.request("GET", "/me", token=token)
        self.assertEqual((status, me["onboarding"]["state"]), (200, "pending"))

    def test_password_account_duplicate_username(self):
        status, _ = self.create_password_account(username="dup.user")
        self.assertEqual(status, 201)
        status, payload = self.create_password_account(username="dup.user", password="another long passphrase")
        self.assertEqual((status, payload["error"]["code"]), (409, "username_unavailable"))

    def test_password_username_normalization(self):
        status, created = self.create_password_account(username="Mixed.Case")
        self.assertEqual(status, 201)
        status, payload, _ = self.request(
            "POST", "/auth/password/login", {"username": "mixed.case", "password": "a long memorable passphrase"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["user"]["id"], created["user"]["id"])
        status, conflict = self.create_password_account(username="MIXED.CASE", password="yet another passphrase")
        self.assertEqual((status, conflict["error"]["code"]), (409, "username_unavailable"))

    def test_password_account_invalid_input(self):
        status, payload = self.create_password_account(username="ab")
        self.assertEqual((status, payload["error"]["code"]), (422, "invalid_username"))
        status, payload = self.create_password_account(username="bad username!")
        self.assertEqual((status, payload["error"]["code"]), (422, "invalid_username"))
        status, payload = self.create_password_account(username="short.pw.user", password="short")
        self.assertEqual((status, payload["error"]["code"]), (422, "weak_password"))

    def test_password_login_incorrect_credentials(self):
        self.create_password_account(username="login.user")
        status, payload, _ = self.request(
            "POST", "/auth/password/login", {"username": "login.user", "password": "the wrong passphrase here"}
        )
        self.assertEqual((status, payload["error"]["code"]), (401, "invalid_credentials"))
        status, payload, _ = self.request(
            "POST", "/auth/password/login", {"username": "nobody.here", "password": "a long memorable passphrase"}
        )
        self.assertEqual((status, payload["error"]["code"]), (401, "invalid_credentials"))

    def test_password_account_creation_rate_limiting(self):
        for _ in range(5):
            self.create_password_account(username="rate.limited")
        status, payload = self.create_password_account(username="rate.limited")
        self.assertEqual((status, payload["error"]["code"]), (429, "account_creation_rate_limited"))

    def test_password_login_rate_limiting(self):
        self.create_password_account(username="rate.login")
        for _ in range(5):
            self.request(
                "POST", "/auth/password/login", {"username": "rate.login", "password": "the wrong passphrase here"}
            )
        status, payload, _ = self.request(
            "POST", "/auth/password/login", {"username": "rate.login", "password": "the wrong passphrase here"}
        )
        self.assertEqual((status, payload["error"]["code"]), (429, "login_rate_limited"))

    def test_password_account_state_survives_store_reload(self):
        self.create_password_account(username="persisted.user")
        reloaded = self.make_store(self.seed_dir, self.temporary.name)
        try:
            self.assertEqual(len(reloaded.list_accounts()), 1)
            identifier = reloaded.find_login_identifier("username", "persisted.user")
            self.assertIsNotNone(identifier)
            self.assertIsNotNone(reloaded.find_authenticator(identifier["accountId"], "password"))
        finally:
            reloaded.close()

    def test_password_material_absent_from_responses(self):
        status, created = self.create_password_account(username="secret.user")
        self.assertEqual(status, 201)
        token = created["accessToken"]
        _, me, _ = self.request("GET", "/me", token=token)
        _, logged_in, _ = self.request(
            "POST", "/auth/password/login", {"username": "secret.user", "password": "a long memorable passphrase"}
        )
        for payload in (created, me, logged_in):
            serialized = json.dumps(payload)
            self.assertNotIn("password", serialized.lower())
            self.assertNotIn("pbkdf2", serialized)


class JsonStoreApiTestCase(ApiTestCase):
    @classmethod
    def make_store(cls, seed_dir, runtime_dir):
        return JsonStore(seed_dir, runtime_dir)


class SqliteStoreApiTestCase(ApiTestCase):
    @classmethod
    def make_store(cls, seed_dir, runtime_dir):
        return SqliteStore(seed_dir, os.path.join(runtime_dir, "state.db"))


if __name__ == "__main__":
    unittest.main()
