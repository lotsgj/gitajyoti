import json
import os
import sys
import tempfile
import threading
import unittest


SERVER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_ROOT not in sys.path:
    sys.path.insert(0, SERVER_ROOT)

from api import create_app  # noqa: E402
from api.storage import JsonStore  # noqa: E402
from api.sqlite_store import SqliteStore  # noqa: E402


class ApiTestCase(unittest.TestCase):
    """Shared behavioral tests for every `Store` implementation (per
    ADR-0009: "every store implementation needs shared behavioral tests for
    query results, mutation semantics, isolation, and failure behavior").
    Not run directly -- see the `JsonStoreApiTestCase`/`SqliteStoreApiTestCase`
    subclasses at the bottom, which only supply `make_store`. Every test
    method here runs once per concrete subclass, against a real Flask app
    (via its WSGI test client) backed by that subclass's store."""

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
        cls.app = create_app(
            cls.seed_dir,
            cls.temporary.name,
            "test-secret",
            allowed_origins={"http://localhost:8000"},
            now=lambda: cls.current_time[0],
            store=cls.store,
        )
        # Deliberately not setting cls.app.testing = True: that flips Flask's
        # PROPAGATE_EXCEPTIONS default, which would bypass the custom
        # @app.errorhandler(Exception) mapping under test and make an
        # unexpected error blow up the test run instead of exercising the
        # same generic-500-plus-logged-traceback path a real client sees.
        cls.client = cls.app.test_client()
        cls.base = "/api/v1"

    @classmethod
    def tearDownClass(cls):
        if cls is ApiTestCase:
            return
        cls.store.close()
        cls.temporary.cleanup()

    def setUp(self):
        self.request("POST", "/dev/reset", {})
        self.current_time[0] = 1788000000

    def request(self, method, path, body=None, token=None, origin=None, if_none_match=None):
        headers = {}
        if token:
            headers["Authorization"] = "Bearer " + token
        if origin:
            headers["Origin"] = origin
        if if_none_match:
            headers["If-None-Match"] = if_none_match
        kwargs = {"headers": headers}
        if body is not None:
            kwargs["json"] = body
        response = self.client.open(self.base + path, method=method, **kwargs)
        return response.status_code, response.get_json(), response.headers

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

    def test_catalogue_http_caching(self):
        # Cacheable routes (explicit opt-in via @cacheable, not derived from
        # any other property) get a real Cache-Control + ETag, and a repeat
        # request quoting that ETag gets a 304 with no body.
        status, _, headers = self.request("GET", "/experiences")
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Cache-Control"), "public, max-age=300, must-revalidate")
        etag = headers.get("ETag")
        self.assertTrue(etag)

        status, body, _ = self.request("GET", "/experiences", if_none_match=etag)
        self.assertEqual(status, 304)
        self.assertFalse(body)

        # Deny-by-default: everything not explicitly marked cacheable keeps
        # no-store, including an error response on an otherwise-cacheable
        # route (an unknown slug's 404 must never be cached).
        status, _, health_headers = self.request("GET", "/health")
        self.assertEqual((status, health_headers.get("Cache-Control")), (200, "no-store"))
        status, _, index_headers = self.request("GET", "")
        self.assertEqual((status, index_headers.get("Cache-Control")), (200, "no-store"))
        status, _, unknown_headers = self.request("GET", "/experiences/does-not-exist")
        self.assertEqual((status, unknown_headers.get("Cache-Control")), (404, "no-store"))

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

    def test_catalogue_manifest_and_summaries_agree_and_support_conditional_get(self):
        status, manifest, manifest_headers = self.request("GET", "/experience-catalogue/manifest")
        self.assertEqual(status, 200)
        self.assertEqual(manifest_headers.get("Cache-Control"), "public, no-cache")
        # The manifest's ETag is NOT catalogueVersion alone -- catalogueVersion
        # is narrowed to summary-relevant fields, so it can't by itself detect
        # a detail-only change to a listed detailVersion (see
        # test_catalogue_manifest_etag_reacts_to_detail_only_change). It's
        # weak, since generatedAt changes every request while the semantic
        # content (catalogueVersion + detailVersions) may not.
        manifest_etag = manifest_headers.get("ETag")
        self.assertTrue(manifest_etag.startswith("W/"), manifest_etag)
        self.assertNotEqual(manifest_etag, '"%s"' % manifest["catalogueVersion"])
        self.assertEqual(len(manifest["experiences"]), 4)

        status, summaries, summaries_headers = self.request("GET", "/experience-catalogue/summaries")
        self.assertEqual(status, 200)
        # catalogueVersion itself still agrees between the two endpoints --
        # a client that read it from one can trust it against the other.
        self.assertEqual(summaries["catalogueVersion"], manifest["catalogueVersion"])
        # Summaries has no detail content and no generatedAt in its body, so
        # its ETag stays strong and is exactly catalogueVersion.
        summaries_etag = summaries_headers.get("ETag")
        self.assertFalse(summaries_etag.startswith("W/"), summaries_etag)
        self.assertEqual(summaries_etag, '"%s"' % summaries["catalogueVersion"])
        self.assertEqual(len(summaries["items"]), 4)

        # unchanged -> 304 on both, with no body -- confirms If-None-Match
        # works against the manifest's weak ETag, not just the summaries'
        # strong one.
        status, body, _ = self.request("GET", "/experience-catalogue/manifest", if_none_match=manifest_etag)
        self.assertEqual((status, body), (304, None))
        status, body, _ = self.request("GET", "/experience-catalogue/summaries", if_none_match=summaries_etag)
        self.assertEqual((status, body), (304, None))

    def test_experience_detail_etag_matches_manifest_detail_version(self):
        # The manifest's per-experience detailVersion and the actual
        # GET /experiences/{id} ETag must be the identical value, computed
        # the same way -- a client comparing the manifest's detailVersion
        # against its own cached ETag must correctly predict a 200 vs 304.
        _, manifest, _ = self.request("GET", "/experience-catalogue/manifest")
        reference = next(item for item in manifest["experiences"] if item["id"] == "exp-gita-sara")

        status, _, headers = self.request("GET", "/experiences/exp-gita-sara")
        self.assertEqual((status, headers.get("ETag")), (200, '"%s"' % reference["detailVersion"]))

        status, body, _ = self.request("GET", "/experiences/exp-gita-sara", if_none_match=headers.get("ETag"))
        self.assertEqual((status, body), (304, None))

    def _mutate_experience_detail_only_field(self, experience_id, field, value):
        """Test-only: change a detail-only field of a seeded experience
        directly in the store, bypassing the read-only public API -- there
        is no endpoint to edit an experience, so this is the only way to
        simulate the scenario these tests need. Reaches into each store's
        internals deliberately; never do this outside a test."""
        if isinstance(self.store, JsonStore):
            for item in self.store._experiences:  # noqa: SLF001
                if item["id"] == experience_id:
                    item[field] = value
                    return
            raise AssertionError("experience not found: %s" % experience_id)
        if isinstance(self.store, SqliteStore):
            experience = self.store.find_experience(experience_id)
            experience[field] = value
            self.store._connection.execute(  # noqa: SLF001
                "UPDATE experiences SET data = ? WHERE id = ?", (json.dumps(experience), experience_id)
            )
            self.store._connection.commit()  # noqa: SLF001
            return
        raise AssertionError("unsupported store type: %r" % type(self.store))

    def test_catalogue_manifest_etag_reacts_to_detail_only_change(self):
        # description is detail-only (not in SUMMARY_FIELDS): changing it
        # must change detailVersion and the manifest's own ETag, but must
        # NOT change catalogueVersion or the summaries ETag -- proving the
        # manifest ETag fix actually closes the gap catalogueVersion alone
        # would miss.
        _, manifest_before, manifest_headers_before = self.request("GET", "/experience-catalogue/manifest")
        _, summaries_before, summaries_headers_before = self.request("GET", "/experience-catalogue/summaries")
        reference_before = next(item for item in manifest_before["experiences"] if item["id"] == "exp-gita-sara")

        self._mutate_experience_detail_only_field(
            "exp-gita-sara", "description", "A changed description, for this test only."
        )

        status, manifest_after, manifest_headers_after = self.request("GET", "/experience-catalogue/manifest")
        self.assertEqual(status, 200)
        _, summaries_after, summaries_headers_after = self.request("GET", "/experience-catalogue/summaries")
        reference_after = next(item for item in manifest_after["experiences"] if item["id"] == "exp-gita-sara")

        # The changed experience's detailVersion changes.
        self.assertNotEqual(reference_after["detailVersion"], reference_before["detailVersion"])
        # catalogueVersion does not -- description isn't a summary field.
        self.assertEqual(manifest_after["catalogueVersion"], manifest_before["catalogueVersion"])
        self.assertEqual(summaries_after["catalogueVersion"], summaries_before["catalogueVersion"])
        # Nor does the summaries ETag (still catalogueVersion-derived).
        self.assertEqual(summaries_headers_after.get("ETag"), summaries_headers_before.get("ETag"))
        # But the manifest's OWN ETag must change -- this is the fix.
        self.assertNotEqual(manifest_headers_after.get("ETag"), manifest_headers_before.get("ETag"))

        # A client's stale If-None-Match (from before the change) must now
        # miss -- a fresh 200 with the new content, not an incorrect 304.
        status, body, _ = self.request(
            "GET", "/experience-catalogue/manifest", if_none_match=manifest_headers_before.get("ETag")
        )
        self.assertEqual(status, 200)
        self.assertIsNotNone(body)

        # The experience's own detail endpoint reflects the change too.
        status, _, exp_headers = self.request("GET", "/experiences/exp-gita-sara")
        self.assertEqual((status, exp_headers.get("ETag")), (200, '"%s"' % reference_after["detailVersion"]))

    def test_catalogue_and_my_manifest_etags_are_weak(self):
        _, _, manifest_headers = self.request("GET", "/experience-catalogue/manifest")
        manifest_etag = manifest_headers.get("ETag")
        self.assertTrue(manifest_etag.startswith("W/"), manifest_etag)

        status, created = self.create_password_account(username="weak.etag.user")
        self.assertEqual(status, 201)
        token = created["accessToken"]
        _, _, my_manifest_headers = self.request("GET", "/me/manifest", token=token)
        my_manifest_etag = my_manifest_headers.get("ETag")
        self.assertTrue(my_manifest_etag.startswith("W/"), my_manifest_etag)

        # Strong ETags are unaffected: summaries and experience detail still
        # assert byte-for-byte identity correctly, since neither body
        # carries a per-request-changing field like generatedAt.
        _, _, summaries_headers = self.request("GET", "/experience-catalogue/summaries")
        self.assertFalse(summaries_headers.get("ETag", "").startswith("W/"))
        _, _, exp_headers = self.request("GET", "/experiences/exp-gita-sara")
        self.assertFalse(exp_headers.get("ETag", "").startswith("W/"))

    def test_weak_manifest_etags_support_conditional_get(self):
        # Confirms If-None-Match actually works against a weak ETag, not
        # just that the server labels it weak -- RFC 7232 mandates weak
        # comparison for If-None-Match, and Werkzeug's make_conditional must
        # implement that correctly for these routes to ever return 304.
        _, _, manifest_headers = self.request("GET", "/experience-catalogue/manifest")
        status, body, _ = self.request(
            "GET", "/experience-catalogue/manifest", if_none_match=manifest_headers.get("ETag")
        )
        self.assertEqual((status, body), (304, None))

        status, created = self.create_password_account(username="weak.etag.conditional")
        self.assertEqual(status, 201)
        token = created["accessToken"]
        _, _, my_manifest_headers = self.request("GET", "/me/manifest", token=token)
        status, body, _ = self.request(
            "GET", "/me/manifest", token=token, if_none_match=my_manifest_headers.get("ETag")
        )
        self.assertEqual((status, body), (304, None))

    def test_my_manifest_versions_change_independently(self):
        # "changed": each projection's version reacts only to its own kind
        # of mutation. "missing"/empty state: a brand-new Account with no
        # Journeys or interests yet still returns a valid, stable manifest.
        status, created = self.create_password_account(username="manifest.user")
        self.assertEqual(status, 201)
        token = created["accessToken"]

        status, before, before_headers = self.request("GET", "/me/manifest", token=token)
        self.assertEqual(status, 200)
        self.assertEqual(before["accountId"], created["user"]["id"])
        self.assertEqual(before_headers.get("Cache-Control"), "private, no-cache")

        # unchanged -> 304.
        status, body, _ = self.request("GET", "/me/manifest", token=token, if_none_match=before_headers.get("ETag"))
        self.assertEqual((status, body), (304, None))

        # Profile update changes only profileVersion.
        self.request("PATCH", "/me", {"city": "Bengaluru"}, token)
        _, after_profile, _ = self.request("GET", "/me/manifest", token=token)
        self.assertNotEqual(after_profile["profileVersion"], before["profileVersion"])
        self.assertEqual(after_profile["accountVersion"], before["accountVersion"])
        self.assertEqual(after_profile["journeyVersion"], before["journeyVersion"])
        self.assertEqual(after_profile["interestVersion"], before["interestVersion"])
        self.assertEqual(after_profile["activityStateVersion"], before["activityStateVersion"])

        # Enrolling changes journeyVersion (and activityStateVersion, since
        # the enrolled Journey's completedActivityIds now exists) but not
        # profileVersion.
        _, journey, _ = self.request(
            "POST", "/me/journey", {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"}, token
        )
        _, after_enrol, _ = self.request("GET", "/me/manifest", token=token)
        self.assertNotEqual(after_enrol["journeyVersion"], after_profile["journeyVersion"])
        self.assertEqual(after_enrol["profileVersion"], after_profile["profileVersion"])

        # Completing an activity changes activityStateVersion but not
        # journeyVersion (enrolment identity is unchanged) or profileVersion.
        activity_id = journey["nextActivity"]["id"]
        self.request("POST", "/me/activities/" + activity_id + "/complete", {}, token)
        _, after_activity, _ = self.request("GET", "/me/manifest", token=token)
        self.assertNotEqual(after_activity["activityStateVersion"], after_enrol["activityStateVersion"])
        self.assertEqual(after_activity["journeyVersion"], after_enrol["journeyVersion"])
        self.assertEqual(after_activity["profileVersion"], after_enrol["profileVersion"])

        # Registering interest changes only interestVersion.
        self.request("POST", "/me/interests", {"experienceId": "exp-purna-yoga"}, token)
        _, after_interest, _ = self.request("GET", "/me/manifest", token=token)
        self.assertNotEqual(after_interest["interestVersion"], after_activity["interestVersion"])
        self.assertEqual(after_interest["journeyVersion"], after_activity["journeyVersion"])
        self.assertEqual(after_interest["activityStateVersion"], after_activity["activityStateVersion"])

    def test_my_manifest_requires_authentication(self):
        status, payload, headers = self.request("GET", "/me/manifest")
        self.assertEqual((status, payload["error"]["code"]), (401, "authentication_required"))
        self.assertEqual(headers.get("Cache-Control"), "no-store")

    def test_my_manifest_isolated_between_accounts(self):
        _, first = self.create_password_account(username="manifest.first")
        _, second = self.create_password_account(username="manifest.second", password="another long passphrase")
        first_token, second_token = first["accessToken"], second["accessToken"]

        self.request(
            "POST", "/me/journey", {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"}, first_token
        )

        _, first_manifest, _ = self.request("GET", "/me/manifest", token=first_token)
        _, second_manifest, _ = self.request("GET", "/me/manifest", token=second_token)

        self.assertEqual(first_manifest["accountId"], first["user"]["id"])
        self.assertEqual(second_manifest["accountId"], second["user"]["id"])
        self.assertNotEqual(first_manifest["accountId"], second_manifest["accountId"])
        # Only the first Account enrolled -- its journeyVersion must differ
        # from the second, unenrolled Account's, proving the second
        # Account's manifest was computed from its own data, not the
        # first's.
        self.assertNotEqual(first_manifest["journeyVersion"], second_manifest["journeyVersion"])

    # -- Data-use optimization Phase 5 prerequisite: /me/journeys,
    #    /me/interests (GET), /me/activity-state -- independently-fetchable
    #    projections behind /me/manifest's journeyVersion/interestVersion/
    #    activityStateVersion. -----------------------------------------

    def test_my_journeys_interests_activity_state_require_authentication(self):
        for path in ("/me/journeys", "/me/interests", "/me/activity-state"):
            status, payload, headers = self.request("GET", path)
            self.assertEqual((status, payload["error"]["code"]), (401, "authentication_required"))
            self.assertEqual(headers.get("Cache-Control"), "no-store")

    def test_my_journeys_interests_activity_state_empty_projection(self):
        status, created = self.create_password_account(username="empty.projection")
        self.assertEqual(status, 201)
        token = created["accessToken"]

        status, journeys, headers = self.request("GET", "/me/journeys", token=token)
        self.assertEqual((status, journeys), (200, {"items": []}))
        self.assertEqual(headers.get("Cache-Control"), "private, no-cache")
        self.assertTrue(headers.get("ETag"))

        status, interests, headers = self.request("GET", "/me/interests", token=token)
        self.assertEqual((status, interests), (200, {"items": []}))
        self.assertEqual(headers.get("Cache-Control"), "private, no-cache")
        self.assertTrue(headers.get("ETag"))

        status, activity_state, headers = self.request("GET", "/me/activity-state", token=token)
        self.assertEqual((status, activity_state), (200, {"items": []}))
        self.assertEqual(headers.get("Cache-Control"), "private, no-cache")
        self.assertTrue(headers.get("ETag"))

    def test_my_journeys_etag_matches_manifest_journey_version_and_is_weak(self):
        # journeyVersion only hashes identity fields (JOURNEY_IDENTITY_FIELDS)
        # -- lastAccessed/completedActivityIds in the body can change without
        # it, so the ETag must be weak, not strong.
        status, created = self.create_password_account(username="journeys.etag")
        self.assertEqual(status, 201)
        token = created["accessToken"]
        _, manifest, _ = self.request("GET", "/me/manifest", token=token)

        status, _, headers = self.request("GET", "/me/journeys", token=token)
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("ETag"), 'W/"%s"' % manifest["journeyVersion"])

        status, body, _ = self.request("GET", "/me/journeys", token=token, if_none_match=headers.get("ETag"))
        self.assertEqual((status, body), (304, None))

    def test_my_interests_etag_matches_manifest_interest_version_and_is_strong(self):
        status, created = self.create_password_account(username="interests.etag")
        self.assertEqual(status, 201)
        token = created["accessToken"]
        _, manifest, _ = self.request("GET", "/me/manifest", token=token)

        status, _, headers = self.request("GET", "/me/interests", token=token)
        self.assertEqual(status, 200)
        etag = headers.get("ETag")
        self.assertFalse(etag.startswith("W/"), etag)
        self.assertEqual(etag, '"%s"' % manifest["interestVersion"])

        status, body, _ = self.request("GET", "/me/interests", token=token, if_none_match=etag)
        self.assertEqual((status, body), (304, None))

    def test_my_activity_state_etag_matches_manifest_activity_state_version_and_is_strong(self):
        status, created = self.create_password_account(username="activity-state.etag")
        self.assertEqual(status, 201)
        token = created["accessToken"]
        _, manifest, _ = self.request("GET", "/me/manifest", token=token)

        status, _, headers = self.request("GET", "/me/activity-state", token=token)
        self.assertEqual(status, 200)
        etag = headers.get("ETag")
        self.assertFalse(etag.startswith("W/"), etag)
        self.assertEqual(etag, '"%s"' % manifest["activityStateVersion"])

        status, body, _ = self.request("GET", "/me/activity-state", token=token, if_none_match=etag)
        self.assertEqual((status, body), (304, None))

    def test_my_journeys_isolated_between_accounts(self):
        _, first = self.create_password_account(username="journeys.first")
        _, second = self.create_password_account(username="journeys.second", password="another long passphrase")
        first_token, second_token = first["accessToken"], second["accessToken"]

        self.request(
            "POST", "/me/journey", {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"}, first_token
        )

        _, first_journeys, _ = self.request("GET", "/me/journeys", token=first_token)
        _, second_journeys, _ = self.request("GET", "/me/journeys", token=second_token)
        self.assertEqual(len(first_journeys["items"]), 1)
        self.assertEqual(second_journeys["items"], [])
        self.assertEqual(first_journeys["items"][0]["userId"], first["user"]["id"])

    def test_my_interests_isolated_between_accounts(self):
        _, first = self.create_password_account(username="interests.first")
        _, second = self.create_password_account(username="interests.second", password="another long passphrase")
        first_token, second_token = first["accessToken"], second["accessToken"]

        self.request("POST", "/me/interests", {"experienceId": "exp-purna-yoga"}, first_token)

        _, first_interests, _ = self.request("GET", "/me/interests", token=first_token)
        _, second_interests, _ = self.request("GET", "/me/interests", token=second_token)
        self.assertEqual(len(first_interests["items"]), 1)
        self.assertEqual(second_interests["items"], [])
        self.assertEqual(first_interests["items"][0]["userId"], first["user"]["id"])

    def test_my_activity_state_isolated_between_accounts(self):
        _, first = self.create_password_account(username="activity-state.first")
        _, second = self.create_password_account(username="activity-state.second", password="another long passphrase")
        first_token, second_token = first["accessToken"], second["accessToken"]

        _, journey, _ = self.request(
            "POST", "/me/journey", {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"}, first_token
        )
        activity_id = journey["nextActivity"]["id"]
        self.request("POST", "/me/activities/" + activity_id + "/complete", {}, first_token)

        _, first_state, _ = self.request("GET", "/me/activity-state", token=first_token)
        _, second_state, _ = self.request("GET", "/me/activity-state", token=second_token)
        self.assertEqual(first_state["items"], [{"journeyId": journey["id"], "completedActivityIds": [activity_id]}])
        self.assertEqual(second_state["items"], [])

    def test_only_appropriate_etag_changes_after_journey_mutations(self):
        # Enrolment changes both the journeys ETag (a new journey's identity
        # fields) and the activity-state ETag (a new journey row now exists
        # there too, with an empty completedActivityIds) -- but not
        # interests. Activity completion (leaving the journey still active --
        # exp-gita-sara has 3 activities) changes only the activity-state
        # ETag: identity fields are unchanged, so journeys does not move.
        # Interest registration changes only the interests ETag. Profile
        # updates change none of the three. Mirrors
        # test_my_manifest_versions_change_independently but exercised
        # against the three new endpoints' own ETags directly.
        status, created = self.create_password_account(username="etag.isolation")
        self.assertEqual(status, 201)
        token = created["accessToken"]

        def etags():
            _, _, journeys_headers = self.request("GET", "/me/journeys", token=token)
            _, _, interests_headers = self.request("GET", "/me/interests", token=token)
            _, _, activity_state_headers = self.request("GET", "/me/activity-state", token=token)
            return journeys_headers.get("ETag"), interests_headers.get("ETag"), activity_state_headers.get("ETag")

        before = etags()

        self.request("PATCH", "/me", {"city": "Bengaluru"}, token)
        after_profile = etags()
        self.assertEqual(after_profile, before)

        _, journey, _ = self.request(
            "POST", "/me/journey", {"experienceId": "exp-gita-sara", "batchId": "batch-sara-2026-09"}, token
        )
        after_enrol = etags()
        self.assertNotEqual(after_enrol[0], after_profile[0])
        self.assertEqual(after_enrol[1], after_profile[1])
        self.assertNotEqual(after_enrol[2], after_profile[2])

        activity_id = journey["nextActivity"]["id"]
        self.request("POST", "/me/activities/" + activity_id + "/complete", {}, token)
        after_activity = etags()
        self.assertEqual(after_activity[0], after_enrol[0])
        self.assertEqual(after_activity[1], after_enrol[1])
        self.assertNotEqual(after_activity[2], after_enrol[2])

        self.request("POST", "/me/interests", {"experienceId": "exp-purna-yoga"}, token)
        after_interest = etags()
        self.assertEqual(after_interest[0], after_activity[0])
        self.assertNotEqual(after_interest[1], after_activity[1])
        self.assertEqual(after_interest[2], after_activity[2])

    def test_my_journeys_interests_activity_state_concurrent_reads_and_mutations(self):
        status, created = self.create_password_account(username="split.concurrent")
        self.assertEqual(status, 201)
        token = created["accessToken"]
        errors = []

        def hammer_reads():
            for _ in range(20):
                try:
                    for path in ("/me/journeys", "/me/interests", "/me/activity-state"):
                        status, payload, _ = self.request("GET", path, token=token)
                        if status != 200 or "items" not in payload:
                            errors.append("unexpected %s response: %s %s" % (path, status, payload))
                except Exception as exc:  # noqa: BLE001
                    errors.append("%s: %s" % (type(exc).__name__, exc))

        def hammer_interest_writes():
            try:
                status, payload, _ = self.request(
                    "POST", "/me/interests", {"experienceId": "exp-purna-yoga"}, token
                )
                if status not in (201, 409):
                    errors.append("unexpected interest-registration status %s: %s" % (status, payload))
            except Exception as exc:  # noqa: BLE001
                errors.append("%s: %s" % (type(exc).__name__, exc))

        threads = [threading.Thread(target=hammer_reads) for _ in range(4)]
        threads += [threading.Thread(target=hammer_interest_writes) for _ in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [])

    def test_manifest_concurrent_reads_and_mutations(self):
        # Concurrent-mutation behavior (per the Phase 2 checklist): manifest
        # reads interleaved with real mutations must never error or return a
        # malformed body, on top of the dedicated store-level corruption
        # regression test in SqliteStoreApiTestCase.
        status, created = self.create_password_account(username="manifest.concurrent")
        self.assertEqual(status, 201)
        token = created["accessToken"]
        errors = []

        def hammer_manifest_reads():
            for _ in range(30):
                try:
                    status, payload, _ = self.request("GET", "/me/manifest", token=token)
                    if status != 200 or "activityStateVersion" not in payload:
                        errors.append("unexpected manifest response: %s %s" % (status, payload))
                except Exception as exc:  # noqa: BLE001
                    errors.append("%s: %s" % (type(exc).__name__, exc))

        def hammer_interest_writes(index):
            try:
                status, payload, _ = self.request(
                    "POST", "/me/interests", {"experienceId": "exp-purna-yoga"}, token
                )
                if status not in (201, 409):
                    errors.append("unexpected interest-registration status %s: %s" % (status, payload))
            except Exception as exc:  # noqa: BLE001
                errors.append("%s: %s" % (type(exc).__name__, exc))

        threads = [threading.Thread(target=hammer_manifest_reads) for _ in range(4)]
        threads += [threading.Thread(target=hammer_interest_writes, args=(i,)) for i in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [])


class JsonStoreApiTestCase(ApiTestCase):
    @classmethod
    def make_store(cls, seed_dir, runtime_dir):
        return JsonStore(seed_dir, runtime_dir)


class SqliteStoreApiTestCase(ApiTestCase):
    @classmethod
    def make_store(cls, seed_dir, runtime_dir):
        return SqliteStore(seed_dir, os.path.join(runtime_dir, "state.db"))

    def test_concurrent_requests_do_not_corrupt_the_database(self):
        # Regression test. SqliteStore originally locked only its write
        # methods; every read method executed against the shared
        # sqlite3.Connection with no synchronization at all. A single
        # sqlite3.Connection is not safe for unsynchronized concurrent use
        # from multiple threads even with check_same_thread=False -- that
        # flag only disables Python's own same-thread assertion. Under real
        # concurrent traffic (Flask's threaded dev server, or any real
        # multi-threaded WSGI server) this let a read interleave with a
        # write on the same connection/cursor and corrupt it -- observed in
        # practice as "sqlite3.DatabaseError: database disk image is
        # malformed" and reproduced directly against SqliteStore before this
        # test existed. Every store method now holds the lock; this drives
        # real concurrent HTTP traffic through the Flask app (via
        # self.client, called from multiple threads) to prove it stays that
        # way.
        # Drives the store directly rather than through HTTP: what's under
        # test is SqliteStore's own thread-safety, not the (unrelated,
        # already-tested-elsewhere) account-creation rate limiter one layer
        # up, which 20 concurrent HTTP account-creation calls from the same
        # test-client address would otherwise trip.
        errors = []

        def hammer_reads():
            for _ in range(300):
                try:
                    self.store.list_experiences()
                    self.store.find_experience("exp-gita-sara")
                except Exception as exc:  # noqa: BLE001 -- any exception here is the failure being tested for
                    errors.append("%s: %s" % (type(exc).__name__, exc))
                    return

        def hammer_writes(index):
            try:
                account = {"id": "user-concurrency-%d" % index, "status": "active", "roles": ["learner"], "createdAt": "now"}
                profile = {
                    "id": "profile-concurrency-%d" % index,
                    "accountId": account["id"],
                    "personalDetails": {
                        "fullName": "",
                        "displayName": "",
                        "email": "",
                        "mobile": "",
                        "dateOfBirth": "",
                        "preferredLanguage": "",
                        "city": "",
                        "country": "India",
                        "timezone": "Asia/Kolkata",
                        "profilePicture": "",
                    },
                    "onboarding": {"state": "pending", "completedAt": None},
                }
                identifier = {"type": "username", "value": "concurrency.user.%d" % index, "accountId": account["id"]}
                authenticator = {"accountId": account["id"], "type": "password", "passwordHash": "x", "createdAt": "now"}
                self.store.create_password_account(account, profile, identifier, authenticator)
            except Exception as exc:  # noqa: BLE001
                errors.append("%s: %s" % (type(exc).__name__, exc))

        threads = [threading.Thread(target=hammer_reads) for _ in range(6)]
        threads += [threading.Thread(target=hammer_writes, args=(i,)) for i in range(20)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [])
        self.assertEqual(len(self.store.list_accounts()), 20)


if __name__ == "__main__":
    unittest.main()
