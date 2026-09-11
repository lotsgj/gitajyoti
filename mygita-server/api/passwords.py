"""Password hashing for the My Gita local mock API.

Uses `hashlib.pbkdf2_hmac` from the Python standard library rather than
Argon2id or scrypt. Argon2id has no standard-library implementation in
Python; adding it would mean a new pip dependency (a C extension), which
this dependency-free local server avoids. `hashlib.scrypt` was tried first
but is not reliably available: it depends on the interpreter's OpenSSL
build implementing scrypt, and on this project's own target environments
that assumption already failed twice --  Apple's bundled macOS Python
(3.9.6, linked against LibreSSL 2.8.3) raises `AttributeError: module
'hashlib' has no attribute 'scrypt'`, and there are matching PythonAnywhere
forum reports of `ValueError: unsupported hash type scrypt` on their
hosted Python images. PBKDF2-HMAC-SHA256 has been in `hashlib` since Python
3.4 with no such dependency, and is OWASP's documented alternative when
Argon2id/scrypt/bcrypt aren't available -- used here at OWASP's current
minimum recommended iteration count for PBKDF2-HMAC-SHA256.

The encoded hash string carries its own algorithm parameters and salt, so a
stored hash is self-describing and its cost parameters can be raised later
without invalidating hashes created under the old parameters.
"""

import base64
import hashlib
import hmac
import secrets


ALGORITHM = "pbkdf2-sha256"
PBKDF2_ITERATIONS = 600_000
PBKDF2_DKLEN = 32
SALT_BYTES = 16


def hash_password(password):
    """Return an encoded hash string carrying its own parameters and salt."""
    salt = secrets.token_bytes(SALT_BYTES)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS, dklen=PBKDF2_DKLEN)
    return "$".join(
        [
            ALGORITHM,
            "iterations=%d" % PBKDF2_ITERATIONS,
            base64.urlsafe_b64encode(salt).decode("ascii"),
            base64.urlsafe_b64encode(derived).decode("ascii"),
        ]
    )


def verify_password(password, encoded):
    """Return True if `password` matches the encoded hash, False otherwise.

    Never raises on a malformed or foreign-algorithm `encoded` value; any
    parsing failure is treated as a non-match.
    """
    try:
        algorithm, iterations_part, salt_b64, hash_b64 = encoded.split("$")
        if algorithm != ALGORITHM:
            return False
        iterations = int(iterations_part.split("=", 1)[1])
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        expected = base64.urlsafe_b64decode(hash_b64.encode("ascii"))
    except (ValueError, TypeError, AttributeError):
        return False
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations, dklen=len(expected))
    return hmac.compare_digest(derived, expected)
