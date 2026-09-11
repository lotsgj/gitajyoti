"""HTTP application for the My Gita local mock API."""

from datetime import date, datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
import secrets
import time
import uuid

from .auth import TokenError, issue_token, verify_token
from .storage import JsonStore


API_PREFIX = "/api/v1"
DEFAULT_ORIGINS = {"http://127.0.0.1:8000", "http://localhost:8000"}


class ApiProblem(Exception):
    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


class MyGitaApplication:
    def __init__(self, store, secret, allowed_origins=None, now=None):
        self.store = store
        self.secret = secret
        self.allowed_origins = set(allowed_origins or DEFAULT_ORIGINS)
        self.now = now or time.time
        self.otp_challenges = {}

    def dispatch(self, method, path, body, headers):
        route = path.rstrip("/") or "/"
        if route == API_PREFIX and method == "GET":
            return 200, {
                "service": "My Gita mock API",
                "version": "1",
                "status": "ok",
                "links": {
                    "health": API_PREFIX + "/health",
                    "experiences": API_PREFIX + "/experiences",
                },
            }
        if route == API_PREFIX + "/health" and method == "GET":
            return 200, {"status": "ok", "service": "mygita-mock-api", "version": "1"}
        if route == API_PREFIX + "/experiences" and method == "GET":
            return 200, {"items": self.store.list_experiences()}
        match = re.fullmatch(API_PREFIX + r"/experiences/([^/]+)/batches", route)
        if match and method == "GET":
            experience = self._experience(match.group(1))
            return 200, {"items": self.store.list_batches(experience["id"])}
        match = re.fullmatch(API_PREFIX + r"/experiences/([^/]+)", route)
        if match and method == "GET":
            return 200, self._experience(match.group(1))
        if route == API_PREFIX + "/auth/otp/request" and method == "POST":
            return 201, self._request_otp(body)
        if route == API_PREFIX + "/auth/otp/verify" and method == "POST":
            return 200, self._verify_otp(body)
        if route == API_PREFIX + "/dev/reset" and method == "POST":
            self.store.reset()
            self.otp_challenges.clear()
            return 200, {"status": "reset"}

        user = self._authenticated_user(headers)
        if route == API_PREFIX + "/me" and method == "GET":
            return 200, user
        if route == API_PREFIX + "/me" and method == "PATCH":
            return 200, self._update_profile(user, body, onboarding=False)
        if route == API_PREFIX + "/me/onboarding" and method == "PATCH":
            return 200, self._update_profile(user, body, onboarding=True)
        self._require_onboarding(user)
        if route == API_PREFIX + "/me/journey" and method == "GET":
            return 200, self._get_journey(user)
        if route == API_PREFIX + "/me/journey" and method == "POST":
            return 201, self._create_journey(user, body)
        if route == API_PREFIX + "/me/interests" and method == "POST":
            return 201, self._register_interest(user, body)
        match = re.fullmatch(API_PREFIX + r"/me/activities/([^/]+)/complete", route)
        if match and method == "POST":
            return 200, self._complete_activity(user, match.group(1))
        match = re.fullmatch(API_PREFIX + r"/me/activities/([^/]+)", route)
        if match and method == "GET":
            return 200, self._get_activity(user, match.group(1))
        raise ApiProblem(404, "not_found", "The requested API route does not exist")

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

    def _request_otp(self, body):
        mobile = self._normalise_mobile(body)
        challenge_id = "otp-" + secrets.token_urlsafe(12)
        self.otp_challenges[challenge_id] = {"mobile": mobile, "expiresAt": int(self.now()) + 300, "attempts": 0}
        return {"challengeId": challenge_id, "expiresInSeconds": 300, "prototypeOtp": "123456"}

    def _verify_otp(self, body):
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
        token = issue_token(user, self.secret, now=self.now())
        return {"accessToken": token, "tokenType": "Bearer", "expiresIn": 28800, "isNewUser": created, "user": user}

    def _authenticated_user(self, headers):
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

    def _require_onboarding(self, user):
        if user.get("onboarding", {}).get("state") != "complete":
            raise ApiProblem(403, "onboarding_required", "Complete the mandatory profile before continuing")

    def _update_profile(self, user, body, onboarding):
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

    def _create_journey(self, user, body):
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
        self.store.create_journey(journey)
        return self._enrich_journey(journey)

    def _register_interest(self, user, body):
        experience = self._experience(str(body.get("experienceId", "")))
        if experience.get("delivery", {}).get("requiresBatch"):
            raise ApiProblem(422, "enrolment_available", "Choose an available batch instead")
        if self.store.find_interest(user["id"], experience["id"]):
            raise ApiProblem(409, "interest_already_registered", "Interest is already registered")
        interest = {"id": "interest-" + uuid.uuid4().hex, "userId": user["id"], "experienceId": experience["id"], "registeredAt": datetime.now(timezone.utc).isoformat()}
        return self.store.create_interest(interest)

    def _enrich_journey(self, journey):
        experience = self.store.find_experience(journey["experienceId"])
        activities = self.store.list_activities(journey["experienceId"])
        remaining = [activity for activity in activities if activity["id"] in journey["activityIds"] and activity["id"] not in journey["completedActivityIds"]]
        enriched = dict(journey)
        enriched["experience"] = {"id": experience["id"], "slug": experience["slug"], "title": experience["title"], "subtitle": experience["subtitle"]}
        enriched["nextActivity"] = remaining[0] if remaining else None
        enriched["progress"] = {"completed": len(journey["completedActivityIds"]), "total": len(journey["activityIds"])}
        return enriched

    def _get_journey(self, user):
        items = [self._enrich_journey(item) for item in self.store.list_journeys(user["id"])]
        interests = self.store.list_interests(user["id"])
        return {"items": items, "interests": interests}

    def _get_activity(self, user, activity_id):
        activity = self.store.find_activity(activity_id)
        journey = self.store.find_journey_for_activity(user["id"], activity_id)
        if not activity or not journey:
            raise ApiProblem(404, "activity_not_found", "Activity is not part of your Journey")
        response = dict(activity)
        response["completed"] = activity_id in journey["completedActivityIds"]
        response["session"] = self.store.find_session(activity_id, journey.get("batchId"))
        return response

    def _complete_activity(self, user, activity_id):
        self._get_activity(user, activity_id)
        journey = self.store.find_journey_for_activity(user["id"], activity_id)
        if activity_id not in journey["completedActivityIds"]:
            journey["completedActivityIds"].append(activity_id)
        if len(journey["completedActivityIds"]) == len(journey["activityIds"]):
            journey["status"] = "completed"
        journey["lastAccessed"] = datetime.now(timezone.utc).isoformat()
        self.store.update_journey(journey)
        return self._enrich_journey(journey)


def make_handler(application):
    class Handler(BaseHTTPRequestHandler):
        server_version = "MyGitaMock/1.0"

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors_headers()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
            self.end_headers()

        def do_GET(self):
            self._handle("GET")

        def do_POST(self):
            self._handle("POST")

        def do_PATCH(self):
            self._handle("PATCH")

        def _handle(self, method):
            try:
                request_path = self.path.split("?", 1)[0]
                if request_path != API_PREFIX and not request_path.startswith(API_PREFIX + "/"):
                    raise ApiProblem(404, "not_found", "The requested API route does not exist")
                body = self._read_json() if method in {"POST", "PATCH"} else {}
                status, payload = application.dispatch(method, request_path, body, self.headers)
                self._send_json(status, payload)
            except ApiProblem as problem:
                error = {"error": {"code": problem.code, "message": problem.message}}
                if problem.details is not None:
                    error["error"]["details"] = problem.details
                self._send_json(problem.status, error)
            except json.JSONDecodeError:
                self._send_json(400, {"error": {"code": "invalid_json", "message": "Request body must be valid JSON"}})
            except Exception:
                self._send_json(500, {"error": {"code": "internal_error", "message": "The mock server encountered an unexpected error"}})

        def _read_json(self):
            length = int(self.headers.get("Content-Length", "0"))
            if length == 0:
                return {}
            if length > 1024 * 1024:
                raise ApiProblem(413, "request_too_large", "Request body is too large")
            return json.loads(self.rfile.read(length).decode("utf-8"))

        def _cors_headers(self):
            origin = self.headers.get("Origin")
            if origin in application.allowed_origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")

        def _send_json(self, status, payload):
            encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self._cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, message, *args):
            print("%s - %s" % (self.address_string(), message % args))

    return Handler


def create_server(host, port, seed_dir, runtime_dir, secret, allowed_origins=None, now=None, store=None):
    """Create the mock API server.

    `store` defaults to a `JsonStore` built from `seed_dir`/`runtime_dir`, but
    accepts any `Store` implementation — this is the substitution point for a
    future database-backed store. `MyGitaApplication` itself never knows
    which one it was given.
    """
    application = MyGitaApplication(store or JsonStore(seed_dir, runtime_dir), secret, allowed_origins=allowed_origins, now=now)
    server = ThreadingHTTPServer((host, port), make_handler(application))
    server.application = application
    return server
