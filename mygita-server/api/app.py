"""Flask application for the My Gita mock/production API.

`MyGitaApplication` holds every business-logic method (OTP, password
Accounts, Profile, Journey, Interest, rate limiting) exactly as it did under
the previous `http.server`-based transport -- none of that code knows or
cares which web framework calls it. Only routing and HTTP-error mapping live
here as Flask idioms. This is the payoff of the `Store` boundary (ADR-0009)
and of keeping business logic decoupled from `dispatch()`/`Handler` all
along: the framework migration touched none of it.
"""

from datetime import date, datetime, timezone
import hashlib
import json
import os
import re
import secrets
import time
import traceback
import uuid

from flask import Flask, g, jsonify, request
from werkzeug.exceptions import BadRequest, MethodNotAllowed, NotFound, RequestEntityTooLarge

from .auth import TokenError, issue_token, verify_token
from .passwords import hash_password, verify_password
from .storage import JsonStore
from .store import DuplicateActiveJourney, DuplicateInterest, DuplicateLoginIdentifier


API_PREFIX = "/api/v1"
DEFAULT_ORIGINS = {"http://127.0.0.1:8000", "http://localhost:8000"}
MAX_BODY_BYTES = 1024 * 1024

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 32
PASSWORD_MIN_LENGTH = 15
PASSWORD_MAX_LENGTH = 128

RATE_LIMIT_WINDOW_SECONDS = 900
RATE_LIMIT_MAX_ATTEMPTS = 5

# Data-use optimization (contract v0.3): fields hashed to produce each opaque
# version. Deliberately narrow -- e.g. SUMMARY_FIELDS excludes detail-only
# content so catalogueVersion changes only when something a Discover card
# actually shows changes, and JOURNEY_IDENTITY_FIELDS excludes lastAccessed
# so a bare "viewed" touch doesn't bump journeyVersion.
SUMMARY_FIELDS = ("id", "slug", "title", "subtitle", "shortDescription", "image", "designedFor", "guidanceMode")
ACCOUNT_FIELDS = ("id", "roles", "status", "createdAt")
PROFILE_FIELDS = ("personalDetails", "onboarding")
JOURNEY_IDENTITY_FIELDS = ("id", "userId", "experienceId", "batchId", "status", "activityIds")


def _hash_json(value):
    """Canonical content hash used as an opaque version/ETag: two calls with
    the same data (regardless of a store's own internal row order) always
    produce the same value, and equality is the only thing a caller may
    infer from it -- callers must not parse, sort, or read chronology into
    the result, matching the contract's OpaqueVersion schema."""
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class ApiProblem(Exception):
    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


class MyGitaApplication:
    """All business logic. Framework-agnostic: every method takes plain
    values (a body dict, a headers-like mapping, a client IP string) and
    returns plain values or raises `ApiProblem` -- nothing here refers to
    Flask, WSGI, or the previous `http.server` transport."""

    def __init__(self, store, secret, allowed_origins=None, now=None):
        self.store = store
        self.secret = secret
        self.allowed_origins = set(allowed_origins or DEFAULT_ORIGINS)
        self.now = now or time.time
        self.otp_challenges = {}
        self.rate_limit_state = {}

    def reset(self):
        self.store.reset()
        self.otp_challenges.clear()
        self.rate_limit_state.clear()
        return {"status": "reset"}

    def _experience(self, identifier):
        experience = self.store.find_experience(identifier)
        if not experience or experience.get("status") != "published":
            raise ApiProblem(404, "experience_not_found", "Experience not found")
        return experience

    def _normalise_mobile(self, body):
        if body.get("countryCode", "+91") != "+91":
            raise ApiProblem(400, "unsupported_country_code", "This prototype currently supports only +91")
        digits = re.sub(r"\D", "", str(body.get("mobile", "")))
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if not re.fullmatch(r"[6-9]\d{9}", digits):
            raise ApiProblem(422, "invalid_mobile", "Enter a valid 10-digit Indian mobile number")
        return "+91" + digits

    def request_otp(self, body):
        mobile = self._normalise_mobile(body)
        challenge_id = "otp-" + secrets.token_urlsafe(12)
        self.otp_challenges[challenge_id] = {"mobile": mobile, "expiresAt": int(self.now()) + 300, "attempts": 0}
        return {"challengeId": challenge_id, "expiresInSeconds": 300, "prototypeOtp": "123456"}

    def verify_otp(self, body):
        challenge = self.otp_challenges.get(str(body.get("challengeId", "")))
        if not challenge:
            raise ApiProblem(400, "invalid_otp_challenge", "OTP challenge is invalid")
        if challenge["expiresAt"] <= int(self.now()):
            self.otp_challenges.pop(str(body.get("challengeId")), None)
            raise ApiProblem(400, "expired_otp", "OTP challenge has expired")
        challenge["attempts"] += 1
        if challenge["attempts"] > 5:
            raise ApiProblem(429, "otp_attempts_exceeded", "Too many OTP attempts")
        if str(body.get("otp", "")) != "123456":
            raise ApiProblem(401, "incorrect_otp", "OTP is incorrect")
        mobile = challenge["mobile"]
        existing = self.store.find_user_by_mobile(mobile)
        created = existing is None
        if created:
            user = {
                "id": "user-" + uuid.uuid4().hex,
                "roles": ["learner"],
                "status": "active",
                "personalDetails": {
                    "fullName": "",
                    "displayName": "",
                    "email": "",
                    "mobile": mobile,
                    "dateOfBirth": "",
                    "preferredLanguage": "",
                    "city": "",
                    "country": "India",
                    "timezone": "Asia/Kolkata",
                    "profilePicture": "",
                },
                "onboarding": {"state": "pending", "completedAt": None},
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            self.store.create_user(user)
        else:
            user = existing
        self.otp_challenges.pop(str(body.get("challengeId")), None)
        return self._issue_session(user, created)

    def _issue_session(self, user, is_new_user):
        """Shared session-issuance path: every authentication method (OTP
        today; password now; future authenticators) converges here once its
        own proof has been verified. See ADR-0010."""
        token = issue_token(user, self.secret, now=self.now())
        return {"accessToken": token, "tokenType": "Bearer", "expiresIn": 28800, "isNewUser": is_new_user, "user": user}

    def _rate_limit_tick(self, bucket, key):
        """Increment the attempt counter for (bucket, key) in the current
        fixed window and return True if the caller is still within the
        allowed rate. Every call counts, including ones on an
        already-exhausted bucket, so a caller stays blocked for the rest of
        the window once it trips."""
        now = int(self.now())
        buckets = self.rate_limit_state.setdefault(bucket, {})
        record = buckets.get(key)
        if record is None or now - record["windowStart"] >= RATE_LIMIT_WINDOW_SECONDS:
            record = {"windowStart": now, "count": 0}
            buckets[key] = record
        record["count"] += 1
        return record["count"] <= RATE_LIMIT_MAX_ATTEMPTS

    def _reset_rate_limit(self, bucket, key):
        self.rate_limit_state.setdefault(bucket, {}).pop(key, None)

    def _normalise_username(self, raw):
        value = str(raw or "")
        if not (USERNAME_MIN_LENGTH <= len(value) <= USERNAME_MAX_LENGTH) or not USERNAME_PATTERN.fullmatch(value):
            raise ApiProblem(
                422,
                "invalid_username",
                "Choose a username of %d-%d letters, digits, '.', '_' or '-', starting with a letter or digit"
                % (USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH),
            )
        return value.lower()

    def _validate_password(self, raw):
        value = str(raw or "")
        if not (PASSWORD_MIN_LENGTH <= len(value) <= PASSWORD_MAX_LENGTH):
            raise ApiProblem(
                422,
                "weak_password",
                "Choose a password of %d-%d characters" % (PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH),
            )
        return value

    def create_password_account(self, body, client_ip):
        # IP gate first: protects against malformed-body request spam too,
        # since it runs before any input is parsed. Username gate follows
        # once the identifier is known to be well-formed.
        if not self._rate_limit_tick("account_creation:ip", client_ip or "unknown"):
            raise ApiProblem(429, "account_creation_rate_limited", "Too many account creation attempts from this address")
        username = self._normalise_username(body.get("username"))
        password = self._validate_password(body.get("password"))
        if not self._rate_limit_tick("account_creation:username", username):
            raise ApiProblem(429, "account_creation_rate_limited", "Too many account creation attempts for this username")
        created_at = datetime.now(timezone.utc).isoformat()
        account = {
            "id": "user-" + uuid.uuid4().hex,
            "status": "active",
            "roles": ["learner"],
            "createdAt": created_at,
        }
        profile = {
            "id": "profile-" + uuid.uuid4().hex,
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
        identifier = {"type": "username", "value": username, "accountId": account["id"]}
        authenticator = {
            "accountId": account["id"],
            "type": "password",
            "passwordHash": hash_password(password),
            "createdAt": created_at,
        }
        try:
            user = self.store.create_password_account(account, profile, identifier, authenticator)
        except DuplicateLoginIdentifier as exc:
            raise ApiProblem(409, "username_unavailable", "Choose a different username") from exc
        return self._issue_session(user, True)

    def login_with_password(self, body, client_ip):
        if not self._rate_limit_tick("password_login:ip", client_ip or "unknown"):
            raise ApiProblem(429, "login_rate_limited", "Too many login attempts from this address")
        username = self._normalise_username(body.get("username"))
        password = self._validate_password(body.get("password"))
        if not self._rate_limit_tick("password_login:username", username):
            raise ApiProblem(429, "login_rate_limited", "Too many login attempts for this username")
        identifier = self.store.find_login_identifier("username", username)
        authenticator = identifier and self.store.find_authenticator(identifier["accountId"], "password")
        # Unknown username and incorrect password return the identical error
        # so the response never discloses whether an Account exists.
        if not authenticator or not verify_password(password, authenticator["passwordHash"]):
            raise ApiProblem(401, "invalid_credentials", "Username or password is incorrect")
        self._reset_rate_limit("password_login:username", username)
        user = self.store.find_user(identifier["accountId"])
        return self._issue_session(user, False)

    def authenticated_user(self, headers):
        authorization = headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            raise ApiProblem(401, "authentication_required", "A bearer token is required")
        try:
            claims = verify_token(authorization[7:], self.secret, now=self.now())
        except TokenError as exc:
            raise ApiProblem(401, "invalid_token", str(exc)) from exc
        user = self.store.find_user(claims["sub"])
        if not user or user.get("status") != "active":
            raise ApiProblem(401, "invalid_user", "The token user is not active")
        return user

    def update_profile(self, user, body, onboarding):
        allowed = {"fullName", "displayName", "dateOfBirth", "email", "preferredLanguage", "city"}
        details = user["personalDetails"]
        for key in allowed:
            if key in body:
                details[key] = str(body[key]).strip()
        if onboarding:
            missing = [field for field in ("fullName", "displayName", "dateOfBirth") if not details.get(field)]
            if missing:
                raise ApiProblem(422, "missing_profile_fields", "Complete all mandatory profile details", {"fields": missing})
            try:
                birth_date = date.fromisoformat(details["dateOfBirth"])
            except ValueError as exc:
                raise ApiProblem(422, "invalid_date_of_birth", "Date of birth must use YYYY-MM-DD") from exc
            if birth_date >= date.today():
                raise ApiProblem(422, "invalid_date_of_birth", "Date of birth must be in the past")
            user["onboarding"] = {"state": "complete", "completedAt": datetime.now(timezone.utc).isoformat()}
        return self.store.update_user(user)

    def create_journey(self, user, body):
        experience = self._experience(str(body.get("experienceId", "")))
        if self.store.find_active_journey(user["id"], experience["id"]):
            raise ApiProblem(409, "duplicate_enrolment", "This Experience is already active in your Journey")
        delivery = experience.get("delivery", {})
        batch_id = body.get("batchId")
        if delivery.get("requiresBatch"):
            batch = self.store.find_batch(batch_id, experience["id"])
            if not batch:
                raise ApiProblem(422, "batch_required", "Choose an available batch")
            if batch.get("enrolment", {}).get("state") != "open":
                raise ApiProblem(409, "batch_not_open", "The selected batch is not open for enrolment")
        activities = self.store.list_activities(experience["id"])
        journey = {
            "id": "journey-" + uuid.uuid4().hex,
            "userId": user["id"],
            "experienceId": experience["id"],
            "batchId": batch_id,
            "status": "active",
            "startedOn": date.today().isoformat(),
            "lastAccessed": datetime.now(timezone.utc).isoformat(),
            "currentContext": experience.get("initialContext", "Beginning the journey"),
            "activityIds": [item["id"] for item in activities],
            "completedActivityIds": [],
        }
        try:
            self.store.create_journey(journey)
        except DuplicateActiveJourney as exc:
            # Backstop for a race the check above already covers in the
            # common case; a store with real constraint support (unlike
            # JsonStore) can still catch the rare concurrent duplicate.
            raise ApiProblem(409, "duplicate_enrolment", "This Experience is already active in your Journey") from exc
        return self._enrich_journey(journey)

    def register_interest(self, user, body):
        experience = self._experience(str(body.get("experienceId", "")))
        if experience.get("delivery", {}).get("requiresBatch"):
            raise ApiProblem(422, "enrolment_available", "Choose an available batch instead")
        if self.store.find_interest(user["id"], experience["id"]):
            raise ApiProblem(409, "interest_already_registered", "Interest is already registered")
        interest = {"id": "interest-" + uuid.uuid4().hex, "userId": user["id"], "experienceId": experience["id"], "registeredAt": datetime.now(timezone.utc).isoformat()}
        try:
            return self.store.create_interest(interest)
        except DuplicateInterest as exc:
            raise ApiProblem(409, "interest_already_registered", "Interest is already registered") from exc

    def _enrich_journey(self, journey):
        experience = self.store.find_experience(journey["experienceId"])
        activities = self.store.list_activities(journey["experienceId"])
        remaining = [activity for activity in activities if activity["id"] in journey["activityIds"] and activity["id"] not in journey["completedActivityIds"]]
        enriched = dict(journey)
        enriched["experience"] = {"id": experience["id"], "slug": experience["slug"], "title": experience["title"], "subtitle": experience["subtitle"]}
        enriched["nextActivity"] = remaining[0] if remaining else None
        enriched["progress"] = {"completed": len(journey["completedActivityIds"]), "total": len(journey["activityIds"])}
        return enriched

    def get_journey(self, user):
        items = [self._enrich_journey(item) for item in self.store.list_journeys(user["id"])]
        interests = self.store.list_interests(user["id"])
        return {"items": items, "interests": interests}

    def get_activity(self, user, activity_id):
        activity = self.store.find_activity(activity_id)
        journey = self.store.find_journey_for_activity(user["id"], activity_id)
        if not activity or not journey:
            raise ApiProblem(404, "activity_not_found", "Activity is not part of your Journey")
        response = dict(activity)
        response["completed"] = activity_id in journey["completedActivityIds"]
        response["session"] = self.store.find_session(activity_id, journey.get("batchId"))
        return response

    def complete_activity(self, user, activity_id):
        self.get_activity(user, activity_id)
        journey = self.store.find_journey_for_activity(user["id"], activity_id)
        if activity_id not in journey["completedActivityIds"]:
            journey["completedActivityIds"].append(activity_id)
        if len(journey["completedActivityIds"]) == len(journey["activityIds"]):
            journey["status"] = "completed"
        journey["lastAccessed"] = datetime.now(timezone.utc).isoformat()
        self.store.update_journey(journey)
        return self._enrich_journey(journey)

    def list_experiences(self):
        return {"items": self.store.list_experiences()}

    def get_experience(self, identifier):
        return self._experience(identifier)

    def get_batches(self, identifier):
        experience = self._experience(identifier)
        return {"items": self.store.list_batches(experience["id"])}

    # -- Data-use optimization: catalogue and MyGita manifests (contract v0.3,
    #    Phase 2). Every version below is a pure content hash of data already
    #    reachable through existing Store methods -- no new Store interface
    #    method was needed. That also makes "change atomically with every
    #    mutation" automatic: a hash of current data is correct the instant
    #    the underlying write commits, with no separate counter to bump or
    #    risk drifting out of sync. --------------------------------------

    def _experience_summary(self, experience):
        return {key: experience[key] for key in SUMMARY_FIELDS}

    def experience_detail_version(self, experience):
        return _hash_json(experience)

    def _catalogue_version(self, experiences):
        canonical = sorted((self._experience_summary(item) for item in experiences), key=lambda item: item["id"])
        return _hash_json(canonical)

    def get_catalogue_manifest(self):
        experiences = self.store.list_experiences()
        return {
            "catalogueVersion": self._catalogue_version(experiences),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "experiences": [
                {"id": item["id"], "slug": item["slug"], "detailVersion": self.experience_detail_version(item)}
                for item in experiences
            ],
        }

    def get_catalogue_summaries(self):
        experiences = self.store.list_experiences()
        return {
            "catalogueVersion": self._catalogue_version(experiences),
            "items": [self._experience_summary(item) for item in experiences],
        }

    def _journey_identity(self, journey):
        return {key: journey[key] for key in JOURNEY_IDENTITY_FIELDS}

    def _journey_activity_state(self, journey):
        return {"id": journey["id"], "completedActivityIds": journey["completedActivityIds"]}

    def _journey_version(self, journeys):
        return _hash_json(sorted((self._journey_identity(item) for item in journeys), key=lambda item: item["id"]))

    def _interest_version(self, interests):
        return _hash_json(sorted(interests, key=lambda item: item["id"]))

    def _activity_state_version(self, journeys):
        return _hash_json(
            sorted((self._journey_activity_state(item) for item in journeys), key=lambda item: item["id"])
        )

    def get_my_manifest(self, user):
        journeys = self.store.list_journeys(user["id"])
        interests = self.store.list_interests(user["id"])
        account_version = _hash_json({key: user[key] for key in ACCOUNT_FIELDS})
        profile_version = _hash_json({key: user[key] for key in PROFILE_FIELDS})
        return {
            "accountId": user["id"],
            "accountVersion": account_version,
            "profileVersion": profile_version,
            "journeyVersion": self._journey_version(journeys),
            "interestVersion": self._interest_version(interests),
            "activityStateVersion": self._activity_state_version(journeys),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    # -- Data-use optimization Phase 5 prerequisite: independently-fetchable
    #    projections behind /me/manifest's three journey-related versions.
    #    Each version below is computed by the exact same private helper
    #    `/me/manifest` uses on the exact same underlying data, so a client
    #    that read a version from the manifest can trust it verbatim as this
    #    endpoint's ETag. -----------------------------------------------

    def get_journeys(self, user):
        """Raw (unenriched) Journey records -- no `experience`/`nextActivity`/
        `progress`, unlike `get_journey`'s compatibility response. journeyVersion
        hashes only JOURNEY_IDENTITY_FIELDS, so this body is not guaranteed
        byte-stable whenever journeyVersion is unchanged: `lastAccessed` and
        `completedActivityIds` can still change (activity completion) without
        it, by design -- that is activityStateVersion's job instead. The route
        marks this ETag weak for exactly that reason."""
        journeys = self.store.list_journeys(user["id"])
        items = sorted(journeys, key=lambda item: item["id"])
        return {"items": items}, self._journey_version(journeys)

    def get_interests(self, user):
        """interestVersion hashes the full interest records this body
        renders (sorted the same way), so the body IS byte-stable whenever
        it's unchanged -- the route uses a strong ETag."""
        interests = self.store.list_interests(user["id"])
        items = sorted(interests, key=lambda item: item["id"])
        return {"items": items}, self._interest_version(interests)

    def get_activity_state(self, user):
        """activityStateVersion hashes exactly the (journey id,
        completedActivityIds) pairs this body renders, so the body IS
        byte-stable whenever it's unchanged -- the route uses a strong
        ETag."""
        journeys = self.store.list_journeys(user["id"])
        items = sorted(
            ({"journeyId": item["id"], "completedActivityIds": item["completedActivityIds"]} for item in journeys),
            key=lambda item: item["journeyId"],
        )
        return {"items": items}, self._activity_state_version(journeys)


def _catalogue_manifest_etag(manifest):
    """ETag for /experience-catalogue/manifest. Must NOT be catalogueVersion
    alone: catalogueVersion is deliberately narrowed to summary-relevant
    fields (see SUMMARY_FIELDS), so a detail-only change (e.g. description)
    changes a listed detailVersion without changing catalogueVersion --
    exactly the case that must still invalidate this manifest's own ETag,
    since the manifest body includes those per-experience detailVersions.
    Hashing catalogueVersion together with the sorted (id, slug,
    detailVersion) entries makes the ETag react to either kind of change.
    /experience-catalogue/summaries has no such gap: its body only ever
    contains summary-derived content, so catalogueVersion alone already
    describes everything in it -- it keeps using catalogueVersion directly
    as its ETag."""
    canonical = {
        "catalogueVersion": manifest["catalogueVersion"],
        "experiences": sorted(
            (
                {"id": item["id"], "slug": item["slug"], "detailVersion": item["detailVersion"]}
                for item in manifest["experiences"]
            ),
            key=lambda item: item["id"],
        ),
    }
    return _hash_json(canonical)


def _combined_manifest_etag(manifest):
    """ETag for /me/manifest: a hash of the five sub-versions together, so a
    conditional GET on the manifest as a whole changes if any one of them
    does. The per-projection versions inside a 200 body are what a client
    then compares individually to decide what to actually refetch."""
    return _hash_json(
        {
            "accountVersion": manifest["accountVersion"],
            "profileVersion": manifest["profileVersion"],
            "journeyVersion": manifest["journeyVersion"],
            "interestVersion": manifest["interestVersion"],
            "activityStateVersion": manifest["activityStateVersion"],
        }
    )


def _error_envelope(code, message, details=None):
    error = {"error": {"code": code, "message": message}}
    if details is not None:
        error["error"]["details"] = details
    return error


def create_app(seed_dir, runtime_dir, secret, allowed_origins=None, now=None, store=None):
    """Create the Flask application.

    `store` defaults to a `JsonStore` built from `seed_dir`/`runtime_dir`,
    but accepts any `Store` implementation, same substitution point as
    before the framework migration. `MyGitaApplication` never knows which
    one it was given, and this factory never knows which WSGI server will
    eventually run it -- `dev_server.py` calls `app.run(...)`, `wsgi.py`
    hands the return value to a production WSGI server.
    """
    mygita = MyGitaApplication(store or JsonStore(seed_dir, runtime_dir), secret, allowed_origins=allowed_origins, now=now)

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_BODY_BYTES
    app.mygita = mygita
    app.url_map.strict_slashes = False

    def route(rule, **options):
        # Flask auto-registers an OPTIONS responder (200, an `Allow` header,
        # no body) on every route unless told not to -- and that
        # auto-response wins over the explicit wildcard preflight handler
        # below, since Werkzeug prefers the more specific rule. Disabling it
        # everywhere routes OPTIONS through the single explicit handler
        # instead, preserving the previous transport's exact 204 response.
        options.setdefault("provide_automatic_options", False)
        return app.route(rule, **options)

    def cacheable(cache_control):
        """Mark a GET view as cacheable -- explicit per-route opt-in, not
        derived from any other property (e.g. "doesn't require auth") the
        route happens to have. `cache_control` is the exact header value to
        emit. Read back by `apply_common_headers` below via
        `app.view_functions`. Deny-by-default stays the rule:
        `Cache-Control: no-store` applies to everything else, error
        responses on a cacheable route included.

        The ETag defaults to a hash of the full response body, which is
        right for a plain resource fetch. A view whose freshness is
        expressed through an opaque version field instead (the catalogue
        and MyGita manifests, and Experience detail once a detailVersion
        exists) sets `g.cache_etag` itself before returning, so the two
        representations of "the same identifier" -- the version inside the
        body and the ETag on the wire -- always agree."""

        def decorator(view):
            view.cache_control = cache_control
            return view

        return decorator

    def body():
        """Parse the request body as JSON, tolerating any Content-Type (the
        previous transport never checked it either) and an empty body."""
        if not request.get_data():
            return {}
        try:
            payload = request.get_json(force=True, silent=False)
        except BadRequest as exc:
            raise ApiProblem(400, "invalid_json", "Request body must be valid JSON") from exc
        return payload if isinstance(payload, dict) else {}

    def client_ip():
        return request.remote_addr

    def authed_user():
        return mygita.authenticated_user(request.headers)

    # -- Service ------------------------------------------------------------

    @route(API_PREFIX, methods=["GET"])
    def api_index():
        return jsonify(
            {
                "service": "My Gita mock API",
                "version": "1",
                "status": "ok",
                "links": {"health": API_PREFIX + "/health", "experiences": API_PREFIX + "/experiences"},
            }
        )

    @route(API_PREFIX + "/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "service": "mygita-mock-api", "version": "1"})

    # -- Experiences ----------------------------------------------------------

    CATALOGUE_CACHE_CONTROL = "public, max-age=300, must-revalidate"

    @route(API_PREFIX + "/experiences", methods=["GET"])
    @cacheable(CATALOGUE_CACHE_CONTROL)
    def list_experiences():
        return jsonify(mygita.list_experiences())

    @route(API_PREFIX + "/experiences/<identifier>/batches", methods=["GET"])
    @cacheable(CATALOGUE_CACHE_CONTROL)
    def get_batches(identifier):
        return jsonify(mygita.get_batches(identifier))

    @route(API_PREFIX + "/experiences/<identifier>", methods=["GET"])
    @cacheable(CATALOGUE_CACHE_CONTROL)
    def get_experience(identifier):
        experience = mygita.get_experience(identifier)
        g.cache_etag = mygita.experience_detail_version(experience)
        return jsonify(experience)

    # -- Data-use optimization: catalogue and MyGita manifests (contract
    #    v0.3). Revalidate-always rather than time-boxed freshness -- these
    #    exist specifically to be polled cheaply via conditional GET, not to
    #    be served stale for a window. Public manifests are marked `public`
    #    (any shared cache may store them); the per-Account manifest is
    #    marked `private` (never served by a shared cache to a different
    #    Account) -- both still `no-cache`, i.e. always revalidate with the
    #    server before use, never served from a local cache unconditionally.

    @route(API_PREFIX + "/experience-catalogue/manifest", methods=["GET"])
    @cacheable("public, no-cache")
    def get_catalogue_manifest():
        manifest = mygita.get_catalogue_manifest()
        # Weak, not strong: generatedAt changes on every request while the
        # semantic content (catalogueVersion + detailVersions) may not --
        # a strong ETag would incorrectly assert byte-for-byte identity
        # that isn't true. Folds in the listed detailVersions, not just
        # catalogueVersion, since catalogueVersion alone doesn't cover a
        # detail-only change (see _catalogue_manifest_etag).
        g.cache_etag = _catalogue_manifest_etag(manifest)
        g.cache_etag_weak = True
        return jsonify(manifest)

    @route(API_PREFIX + "/experience-catalogue/summaries", methods=["GET"])
    @cacheable("public, no-cache")
    def get_catalogue_summaries():
        summary = mygita.get_catalogue_summaries()
        # Strong: this body has no generatedAt and no detail content --
        # catalogueVersion alone already describes everything in it, and is
        # byte-for-byte reproducible whenever catalogueVersion is unchanged.
        g.cache_etag = summary["catalogueVersion"]
        return jsonify(summary)

    @route(API_PREFIX + "/me/manifest", methods=["GET"])
    @cacheable("private, no-cache")
    def get_my_manifest():
        manifest = mygita.get_my_manifest(authed_user())
        # Weak, for the same reason as the catalogue manifest: generatedAt
        # changes every request while the five sub-versions may not.
        g.cache_etag = _combined_manifest_etag(manifest)
        g.cache_etag_weak = True
        return jsonify(manifest)

    # -- Data-use optimization Phase 5 prerequisite: fetch each of
    #    /me/manifest's three journey-related projections independently, so a
    #    client that sees only one of journeyVersion/interestVersion/
    #    activityStateVersion change never has to refetch the other two. Same
    #    `private, no-cache` treatment as /me/manifest -- always revalidate,
    #    never served from a shared cache. Existing GET /me/journey stays
    #    unchanged as a compatibility route.

    @route(API_PREFIX + "/me/journeys", methods=["GET"])
    @cacheable("private, no-cache")
    def get_my_journeys():
        payload, version = mygita.get_journeys(authed_user())
        g.cache_etag = version
        g.cache_etag_weak = True
        return jsonify(payload)

    @route(API_PREFIX + "/me/interests", methods=["GET"])
    @cacheable("private, no-cache")
    def get_my_interests():
        payload, version = mygita.get_interests(authed_user())
        g.cache_etag = version
        return jsonify(payload)

    @route(API_PREFIX + "/me/activity-state", methods=["GET"])
    @cacheable("private, no-cache")
    def get_my_activity_state():
        payload, version = mygita.get_activity_state(authed_user())
        g.cache_etag = version
        return jsonify(payload)

    # -- Auth -----------------------------------------------------------------

    @route(API_PREFIX + "/auth/otp/request", methods=["POST"])
    def request_otp():
        return jsonify(mygita.request_otp(body())), 201

    @route(API_PREFIX + "/auth/otp/verify", methods=["POST"])
    def verify_otp():
        return jsonify(mygita.verify_otp(body()))

    @route(API_PREFIX + "/auth/accounts", methods=["POST"])
    def create_password_account():
        return jsonify(mygita.create_password_account(body(), client_ip())), 201

    @route(API_PREFIX + "/auth/password/login", methods=["POST"])
    def login_with_password():
        return jsonify(mygita.login_with_password(body(), client_ip()))

    # -- Development ------------------------------------------------------------

    @route(API_PREFIX + "/dev/reset", methods=["POST"])
    def dev_reset():
        return jsonify(mygita.reset())

    # -- Identity/Profile (authenticated) ----------------------------------------

    @route(API_PREFIX + "/me", methods=["GET"])
    def get_me():
        return jsonify(authed_user())

    @route(API_PREFIX + "/me", methods=["PATCH"])
    def update_me():
        return jsonify(mygita.update_profile(authed_user(), body(), onboarding=False))

    @route(API_PREFIX + "/me/onboarding", methods=["PATCH"])
    def update_onboarding():
        return jsonify(mygita.update_profile(authed_user(), body(), onboarding=True))

    # -- Journey/Interest/Activity (authenticated; Profile completion is not
    #    an authorization gate here -- ADR-0010) ---------------------------------

    @route(API_PREFIX + "/me/journey", methods=["GET"])
    def get_journey():
        return jsonify(mygita.get_journey(authed_user()))

    @route(API_PREFIX + "/me/journey", methods=["POST"])
    def create_journey():
        return jsonify(mygita.create_journey(authed_user(), body())), 201

    @route(API_PREFIX + "/me/interests", methods=["POST"])
    def register_interest():
        return jsonify(mygita.register_interest(authed_user(), body())), 201

    @route(API_PREFIX + "/me/activities/<activity_id>/complete", methods=["POST"])
    def complete_activity(activity_id):
        return jsonify(mygita.complete_activity(authed_user(), activity_id))

    @route(API_PREFIX + "/me/activities/<activity_id>", methods=["GET"])
    def get_activity(activity_id):
        return jsonify(mygita.get_activity(authed_user(), activity_id))

    # -- Error mapping: every response, expected or not, still goes through
    #    the same {"error": {"code", "message", "details"?}} envelope, and an
    #    unexpected failure is still logged, never silently swallowed. -------

    @app.errorhandler(ApiProblem)
    def handle_api_problem(problem):
        return jsonify(_error_envelope(problem.code, problem.message, problem.details)), problem.status

    @app.errorhandler(NotFound)
    @app.errorhandler(MethodNotAllowed)
    def handle_not_found(_error):
        return jsonify(_error_envelope("not_found", "The requested API route does not exist")), 404

    @app.errorhandler(RequestEntityTooLarge)
    def handle_too_large(_error):
        return jsonify(_error_envelope("request_too_large", "Request body is too large")), 413

    @app.errorhandler(BadRequest)
    def handle_bad_request(_error):
        return jsonify(_error_envelope("invalid_json", "Request body must be valid JSON")), 400

    @app.errorhandler(Exception)
    def handle_unexpected(_error):
        # The client only ever sees the generic message below -- but an
        # unexpected error must leave a diagnostic trail somewhere, or an
        # operator has no way to find out what actually failed.
        traceback.print_exc()
        return jsonify(_error_envelope("internal_error", "The mock server encountered an unexpected error")), 500

    @app.after_request
    def apply_common_headers(response):
        origin = request.headers.get("Origin")
        if origin in mygita.allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.method == "OPTIONS":
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            response.headers["Access-Control-Max-Age"] = "600"

        # Deny-by-default: no-store unless the matched view explicitly opted
        # in via @cacheable, and even then only for a successful GET -- an
        # error response on an otherwise-cacheable route (e.g. an unknown
        # slug's 404, or /me/manifest without a valid token) is never cached.
        view = app.view_functions.get(request.endpoint) if request.endpoint else None
        cache_control = getattr(view, "cache_control", None)
        if request.method == "GET" and response.status_code == 200 and cache_control is not None:
            response.headers["Cache-Control"] = cache_control
            etag = getattr(g, "cache_etag", None)
            if etag is None:
                etag = hashlib.sha256(response.get_data()).hexdigest()
            # Weak (W/"...") for a view whose body carries a field that
            # changes every request (generatedAt) alongside content that may
            # not -- a strong ETag would assert byte-for-byte identity that
            # isn't true. If-None-Match matching against a weak ETag still
            # works: RFC 7232 mandates weak comparison for If-None-Match
            # regardless of either side's weak/strong marker, and
            # make_conditional implements that correctly (confirmed
            # directly, not assumed).
            response.set_etag(etag, weak=getattr(g, "cache_etag_weak", False))
            response = response.make_conditional(request)
        else:
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.route(
        API_PREFIX + "/<path:_subpath>",
        methods=["OPTIONS"],
        provide_automatic_options=False,
    )
    @app.route(API_PREFIX, methods=["OPTIONS"], provide_automatic_options=False)
    def options_preflight(_subpath=None):
        return "", 204

    return app
