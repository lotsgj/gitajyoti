"""SQLite implementation of the persistence boundary defined in `store.py`.

Hybrid relational/document schema, per the design in
`contracts/roadmap.md`: real columns and indexes/constraints only for what
is joined, filtered, or must be unique (ids, slug, status, mobile,
username, the active-journey and interest uniqueness invariants);
everything else -- nested or variable-shaped content such as
personalDetails, intendedOutcomes[], or activityIds[] -- stays as a single
JSON column holding the complete record. Reads `json.loads()` that column;
writes keep the indexed columns in sync with it. This keeps the mapping
between a row and the OpenAPI-shaped domain object close to 1:1, so most
methods are a short SELECT/INSERT plus a JSON (de)serialize, not an ORM.

Reference data (experiences/activities/batches/sessions) is still authored
as JSON files in `mock-data/`, unchanged -- this store re-seeds (upserts)
those tables from the JSON files on every construction, so editing a JSON
file and restarting the server behaves exactly like `JsonStore` today.
Runtime data (identity, journeys, interests) lives only in the database.

Concurrency: one connection per store instance (`check_same_thread=False`),
serialized by a single lock for the same reason `JsonStore` uses one --
this traffic level does not need a connection pool, and a single lock
keeps read-modify-write sequences (e.g. the duplicate-enrolment check in
`api/app.py` followed by `create_journey`) consistent without asking SQLite
to referee cross-connection concurrency this server does not have. WAL
mode is enabled so readers are never blocked by a writer regardless.
"""

import json
import os
import sqlite3
import threading

from .store import DuplicateActiveJourney, DuplicateInterest, DuplicateLoginIdentifier, Store


SCHEMA = """
CREATE TABLE IF NOT EXISTS experiences (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_experiences_status ON experiences(status);

CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    experience_id TEXT NOT NULL REFERENCES experiences(id),
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_experience ON activities(experience_id);

CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    experience_id TEXT NOT NULL REFERENCES experiences(id),
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_batches_experience ON batches(experience_id);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    activity_id TEXT,
    batch_id TEXT,
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_activity_batch ON sessions(activity_id, batch_id);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    mobile TEXT UNIQUE NOT NULL,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id),
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_identifiers (
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    PRIMARY KEY (type, value)
);

CREATE TABLE IF NOT EXISTS authenticators (
    account_id TEXT NOT NULL REFERENCES accounts(id),
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (account_id, type)
);

CREATE TABLE IF NOT EXISTS journeys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    experience_id TEXT NOT NULL REFERENCES experiences(id),
    status TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journeys_user ON journeys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_journey
    ON journeys(user_id, experience_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS interests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    experience_id TEXT NOT NULL REFERENCES experiences(id),
    data TEXT NOT NULL,
    UNIQUE (user_id, experience_id)
);
CREATE INDEX IF NOT EXISTS idx_interests_user ON interests(user_id);
"""


class SqliteStore(Store):
    def __init__(self, seed_dir, db_path):
        self.seed_dir = seed_dir
        self.db_path = db_path
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(db_path, check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA foreign_keys=ON")
        self._connection.executescript(SCHEMA)
        self._connection.commit()
        self._seed_reference_data()

    # -- seeding (mirrors JsonStore's seed loading; source of truth stays
    #    the mock-data/*.json files, re-upserted on every start) ----------

    def _load_seed(self, filename):
        with open(os.path.join(self.seed_dir, filename), "r", encoding="utf-8") as handle:
            return json.load(handle)

    def _seed_reference_data(self):
        with self._lock:
            for item in self._load_seed("experiences.json"):
                self._connection.execute(
                    "INSERT INTO experiences (id, slug, status, data) VALUES (?, ?, ?, ?) "
                    "ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, status=excluded.status, data=excluded.data",
                    (item["id"], item["slug"], item["status"], json.dumps(item)),
                )
            for item in self._load_seed("activities.json"):
                self._connection.execute(
                    "INSERT INTO activities (id, experience_id, data) VALUES (?, ?, ?) "
                    "ON CONFLICT(id) DO UPDATE SET experience_id=excluded.experience_id, data=excluded.data",
                    (item["id"], item["experienceId"], json.dumps(item)),
                )
            for item in self._load_seed("batches.json"):
                self._connection.execute(
                    "INSERT INTO batches (id, experience_id, data) VALUES (?, ?, ?) "
                    "ON CONFLICT(id) DO UPDATE SET experience_id=excluded.experience_id, data=excluded.data",
                    (item["id"], item["experienceId"], json.dumps(item)),
                )
            for item in self._load_seed("sessions.json"):
                self._connection.execute(
                    "INSERT INTO sessions (id, activity_id, batch_id, data) VALUES (?, ?, ?, ?) "
                    "ON CONFLICT(id) DO UPDATE SET activity_id=excluded.activity_id, batch_id=excluded.batch_id, data=excluded.data",
                    (item["id"], item.get("experienceActivityId"), item.get("batchId"), json.dumps(item)),
                )
            self._connection.commit()

    def _row_data(self, row):
        return json.loads(row[0]) if row else None

    def _is_unique_violation(self, exc):
        # sqlite3.IntegrityError covers both UNIQUE and FOREIGN KEY
        # constraint failures with the same exception class; only the
        # message text distinguishes them. A FOREIGN KEY failure means the
        # caller passed a bad reference (a bug, not a legitimate duplicate)
        # and must not be mislabeled as one -- it should surface as-is.
        return "UNIQUE constraint failed" in str(exc)

    def _compose_user_dto(self, account, profile):
        return {
            "id": account["id"],
            "roles": account["roles"],
            "status": account["status"],
            "personalDetails": profile["personalDetails"],
            "onboarding": profile["onboarding"],
            "createdAt": account["createdAt"],
        }

    # -- Reference data ---------------------------------------------------
    #
    # Every method below -- reads included -- holds `self._lock`. A single
    # `sqlite3.Connection` is not safe for unsynchronized concurrent use
    # from multiple threads even with `check_same_thread=False`: that flag
    # only disables Python's own same-thread assertion, it does not make
    # concurrent statement execution on one connection safe. Without this,
    # Flask's threaded dev server (and any real multi-threaded WSGI server)
    # can interleave a read with a write on the same connection/cursor and
    # produce exactly the corruption this was found to cause in practice
    # ("database disk image is malformed"), not just a logical race.

    def list_experiences(self):
        with self._lock:
            rows = self._connection.execute("SELECT data FROM experiences WHERE status = 'published'").fetchall()
        return [json.loads(row[0]) for row in rows]

    def find_experience(self, identifier):
        with self._lock:
            row = self._connection.execute(
                "SELECT data FROM experiences WHERE id = ? OR slug = ?", (identifier, identifier)
            ).fetchone()
        return self._row_data(row)

    def list_batches(self, experience_id):
        with self._lock:
            rows = self._connection.execute(
                "SELECT data FROM batches WHERE experience_id = ?", (experience_id,)
            ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def find_batch(self, batch_id, experience_id):
        with self._lock:
            row = self._connection.execute(
                "SELECT data FROM batches WHERE id = ? AND experience_id = ?", (batch_id, experience_id)
            ).fetchone()
        return self._row_data(row)

    def list_activities(self, experience_id):
        with self._lock:
            rows = self._connection.execute(
                "SELECT data FROM activities WHERE experience_id = ?", (experience_id,)
            ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def find_activity(self, activity_id):
        with self._lock:
            row = self._connection.execute("SELECT data FROM activities WHERE id = ?", (activity_id,)).fetchone()
        return self._row_data(row)

    def find_session(self, activity_id, batch_id):
        with self._lock:
            row = self._connection.execute(
                "SELECT data FROM sessions WHERE activity_id = ? AND batch_id = ?", (activity_id, batch_id)
            ).fetchone()
        return self._row_data(row)

    # -- Identity (legacy mobile-OTP users) --------------------------------

    def find_user(self, user_id):
        with self._lock:
            row = self._connection.execute("SELECT data FROM users WHERE id = ?", (user_id,)).fetchone()
            if row is not None:
                return json.loads(row[0])
            account_row = self._connection.execute("SELECT data FROM accounts WHERE id = ?", (user_id,)).fetchone()
            if account_row is None:
                return None
            profile_row = self._connection.execute(
                "SELECT data FROM profiles WHERE account_id = ?", (user_id,)
            ).fetchone()
            if profile_row is None:
                return None
            return self._compose_user_dto(json.loads(account_row[0]), json.loads(profile_row[0]))

    def find_user_by_mobile(self, mobile):
        with self._lock:
            row = self._connection.execute("SELECT data FROM users WHERE mobile = ?", (mobile,)).fetchone()
        return self._row_data(row)

    def create_user(self, user):
        with self._lock:
            self._connection.execute(
                "INSERT INTO users (id, mobile, data) VALUES (?, ?, ?)",
                (user["id"], user["personalDetails"]["mobile"], json.dumps(user)),
            )
            self._connection.commit()
        return user

    def update_user(self, user):
        with self._lock:
            cursor = self._connection.execute("UPDATE users SET data = ? WHERE id = ?", (json.dumps(user), user["id"]))
            if cursor.rowcount == 0:
                profile_row = self._connection.execute(
                    "SELECT data FROM profiles WHERE account_id = ?", (user["id"],)
                ).fetchone()
                if profile_row is not None:
                    profile = json.loads(profile_row[0])
                    profile["personalDetails"] = user["personalDetails"]
                    profile["onboarding"] = user["onboarding"]
                    self._connection.execute(
                        "UPDATE profiles SET data = ? WHERE account_id = ?", (json.dumps(profile), user["id"])
                    )
            self._connection.commit()
        return user

    def list_users(self):
        with self._lock:
            rows = self._connection.execute("SELECT data FROM users").fetchall()
        return [json.loads(row[0]) for row in rows]

    # -- Account / Profile / Authenticator (password milestone) -----------

    def find_login_identifier(self, identifier_type, value):
        with self._lock:
            row = self._connection.execute(
                "SELECT type, value, account_id FROM login_identifiers WHERE type = ? AND value = ?",
                (identifier_type, value),
            ).fetchone()
        if row is None:
            return None
        return {"type": row[0], "value": row[1], "accountId": row[2]}

    def find_authenticator(self, account_id, authenticator_type):
        with self._lock:
            row = self._connection.execute(
                "SELECT data FROM authenticators WHERE account_id = ? AND type = ?", (account_id, authenticator_type)
            ).fetchone()
        return self._row_data(row)

    def create_password_account(self, account, profile, identifier, authenticator):
        with self._lock:
            try:
                self._connection.execute("INSERT INTO accounts (id, data) VALUES (?, ?)", (account["id"], json.dumps(account)))
                self._connection.execute(
                    "INSERT INTO profiles (id, account_id, data) VALUES (?, ?, ?)",
                    (profile["id"], profile["accountId"], json.dumps(profile)),
                )
                self._connection.execute(
                    "INSERT INTO login_identifiers (type, value, account_id) VALUES (?, ?, ?)",
                    (identifier["type"], identifier["value"], identifier["accountId"]),
                )
                self._connection.execute(
                    "INSERT INTO authenticators (account_id, type, data) VALUES (?, ?, ?)",
                    (authenticator["accountId"], authenticator["type"], json.dumps(authenticator)),
                )
                self._connection.commit()
            except sqlite3.IntegrityError as exc:
                self._connection.rollback()
                if self._is_unique_violation(exc):
                    raise DuplicateLoginIdentifier(identifier["value"]) from exc
                raise
        return self._compose_user_dto(account, profile)

    def list_accounts(self):
        with self._lock:
            rows = self._connection.execute("SELECT data FROM accounts").fetchall()
        return [json.loads(row[0]) for row in rows]

    # -- Journey ------------------------------------------------------------

    def list_journeys(self, user_id):
        with self._lock:
            rows = self._connection.execute("SELECT data FROM journeys WHERE user_id = ?", (user_id,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def find_active_journey(self, user_id, experience_id):
        with self._lock:
            row = self._connection.execute(
                "SELECT data FROM journeys WHERE user_id = ? AND experience_id = ? AND status = 'active'",
                (user_id, experience_id),
            ).fetchone()
        return self._row_data(row)

    def find_journey_for_activity(self, user_id, activity_id):
        with self._lock:
            rows = self._connection.execute("SELECT data FROM journeys WHERE user_id = ?", (user_id,)).fetchall()
        for row in rows:
            journey = json.loads(row[0])
            if activity_id in journey["activityIds"]:
                return journey
        return None

    def create_journey(self, journey):
        with self._lock:
            try:
                self._connection.execute(
                    "INSERT INTO journeys (id, user_id, experience_id, status, data) VALUES (?, ?, ?, ?, ?)",
                    (journey["id"], journey["userId"], journey["experienceId"], journey["status"], json.dumps(journey)),
                )
                self._connection.commit()
            except sqlite3.IntegrityError as exc:
                self._connection.rollback()
                if self._is_unique_violation(exc):
                    raise DuplicateActiveJourney(journey["userId"], journey["experienceId"]) from exc
                raise
        return journey

    def update_journey(self, journey):
        with self._lock:
            self._connection.execute(
                "UPDATE journeys SET status = ?, data = ? WHERE id = ?",
                (journey["status"], json.dumps(journey), journey["id"]),
            )
            self._connection.commit()
        return journey

    # -- Interest -----------------------------------------------------------

    def list_interests(self, user_id):
        with self._lock:
            rows = self._connection.execute("SELECT data FROM interests WHERE user_id = ?", (user_id,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def find_interest(self, user_id, experience_id):
        with self._lock:
            row = self._connection.execute(
                "SELECT data FROM interests WHERE user_id = ? AND experience_id = ?", (user_id, experience_id)
            ).fetchone()
        return self._row_data(row)

    def create_interest(self, interest):
        with self._lock:
            try:
                self._connection.execute(
                    "INSERT INTO interests (id, user_id, experience_id, data) VALUES (?, ?, ?, ?)",
                    (interest["id"], interest["userId"], interest["experienceId"], json.dumps(interest)),
                )
                self._connection.commit()
            except sqlite3.IntegrityError as exc:
                self._connection.rollback()
                if self._is_unique_violation(exc):
                    raise DuplicateInterest(interest["userId"], interest["experienceId"]) from exc
                raise
        return interest

    # -- Lifecycle ------------------------------------------------------------

    def reset(self):
        # Children referencing accounts (via foreign key) must be deleted
        # before accounts itself, or PRAGMA foreign_keys=ON rejects the
        # delete. journeys/interests reference experiences, not accounts,
        # and experiences are never cleared by reset -- order among the
        # remaining tables doesn't matter.
        with self._lock:
            try:
                for table in (
                    "login_identifiers",
                    "authenticators",
                    "profiles",
                    "accounts",
                    "users",
                    "journeys",
                    "interests",
                ):
                    self._connection.execute("DELETE FROM %s" % table)
                self._connection.commit()
            except Exception:
                self._connection.rollback()
                raise

    def close(self):
        self._connection.close()
