"""Small dependency-free JWT helper for local development only."""

import base64
import hashlib
import hmac
import json
import time


class TokenError(ValueError):
    """Raised when a development token cannot be trusted."""


def _encode(value):
    raw = json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _decode(value):
    padding = "=" * (-len(value) % 4)
    return json.loads(base64.urlsafe_b64decode(value + padding).decode("utf-8"))


def issue_token(user, secret, lifetime_seconds=28800, now=None):
    issued_at = int(now if now is not None else time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user["id"],
        "name": user["personalDetails"].get("displayName") or user["personalDetails"].get("fullName") or "Gita Sadhak",
        "roles": user.get("roles", ["learner"]),
        "iss": "mygita-local",
        "aud": "mygita-client",
        "iat": issued_at,
        "exp": issued_at + lifetime_seconds,
    }
    signing_input = "%s.%s" % (_encode(header), _encode(payload))
    signature = hmac.new(secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
    return "%s.%s" % (signing_input, encoded_signature)


def verify_token(token, secret, now=None):
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
        signing_input = "%s.%s" % (encoded_header, encoded_payload)
        expected = hmac.new(secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
        padding = "=" * (-len(encoded_signature) % 4)
        supplied = base64.urlsafe_b64decode(encoded_signature + padding)
        if not hmac.compare_digest(expected, supplied):
            raise TokenError("Invalid token signature")
        header = _decode(encoded_header)
        payload = _decode(encoded_payload)
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        if isinstance(exc, TokenError):
            raise
        raise TokenError("Malformed token") from exc
    if header.get("alg") != "HS256" or payload.get("iss") != "mygita-local" or payload.get("aud") != "mygita-client":
        raise TokenError("Invalid token claims")
    current_time = int(now if now is not None else time.time())
    if int(payload.get("exp", 0)) <= current_time:
        raise TokenError("Token expired")
    if not payload.get("sub"):
        raise TokenError("Token subject missing")
    return payload
