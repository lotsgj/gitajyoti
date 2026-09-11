"""JSON seed and runtime persistence for the local mock API."""

import copy
import json
import os
import tempfile
import threading

from .store import DuplicateLoginIdentifier, Store


INITIAL_RUNTIME_STATE = {
    "users": [],
    "journeys": [],
    "interests": [],
    "accounts": [],
    "profiles": [],
    "loginIdentifiers": [],
    "authenticators": [],
}


class JsonStore(Store):
    """Whole-file JSON implementation of `Store`.

    Every mutation flushes the complete runtime state to disk under a lock.
    That is specific to this implementation, not part of the `Store`
    contract: a database-backed store would instead commit one row per call
    inside a transaction.
    """

    def __init__(self, seed_dir, runtime_dir):
        self.seed_dir = seed_dir
        self.runtime_dir = runtime_dir
        self.state_path = os.path.join(runtime_dir, "state.json")
        self._lock = threading.RLock()
        os.makedirs(runtime_dir, exist_ok=True)
        self._experiences = self._load_seed("experiences.json")
        self._activities = self._load_seed("activities.json")
        self._batches = self._load_seed("batches.json")
        self._sessions = self._load_seed("sessions.json")
        self._state = self._load_runtime()

    def _load_seed(self, filename):
        with open(os.path.join(self.seed_dir, filename), "r", encoding="utf-8") as handle:
            return json.load(handle)

    def _load_runtime(self):
        if not os.path.exists(self.state_path):
            state = copy.deepcopy(INITIAL_RUNTIME_STATE)
            self._write(state)
            return state
        with open(self.state_path, "r", encoding="utf-8") as handle:
            loaded = json.load(handle)
        for key, default in INITIAL_RUNTIME_STATE.items():
            loaded.setdefault(key, copy.deepcopy(default))
        return loaded

    def _write(self, state=None):
        data = state if state is not None else self._state
        os.makedirs(self.runtime_dir, exist_ok=True)
        descriptor, temporary = tempfile.mkstemp(prefix="state-", suffix=".json", dir=self.runtime_dir)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(data, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            os.replace(temporary, self.state_path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def _save(self):
        with self._lock:
            self._write()

    # Reference data.

    def list_experiences(self):
        return [item for item in self._experiences if item.get("status") == "published"]

    def find_experience(self, identifier):
        return next(
            (item for item in self._experiences if item["id"] == identifier or item["slug"] == identifier),
            None,
        )

    def list_batches(self, experience_id):
        return [item for item in self._batches if item["experienceId"] == experience_id]

    def find_batch(self, batch_id, experience_id):
        return next(
            (item for item in self._batches if item["id"] == batch_id and item["experienceId"] == experience_id),
            None,
        )

    def list_activities(self, experience_id):
        return [item for item in self._activities if item["experienceId"] == experience_id]

    def find_activity(self, activity_id):
        return next((item for item in self._activities if item["id"] == activity_id), None)

    def find_session(self, activity_id, batch_id):
        return next(
            (
                item
                for item in self._sessions
                if item.get("experienceActivityId") == activity_id and item.get("batchId") == batch_id
            ),
            None,
        )

    # Identity.

    def find_user(self, user_id):
        legacy = next((user for user in self._state["users"] if user["id"] == user_id), None)
        if legacy is not None:
            return legacy
        account = next((item for item in self._state["accounts"] if item["id"] == user_id), None)
        if account is None:
            return None
        profile = next((item for item in self._state["profiles"] if item["accountId"] == user_id), None)
        if profile is None:
            return None
        return self._compose_user_dto(account, profile)

    def find_user_by_mobile(self, mobile):
        return next(
            (user for user in self._state["users"] if user["personalDetails"].get("mobile") == mobile),
            None,
        )

    def create_user(self, user):
        with self._lock:
            self._state["users"].append(user)
            self._write()
        return user

    def update_user(self, user):
        with self._lock:
            legacy = next((item for item in self._state["users"] if item["id"] == user["id"]), None)
            if legacy is None:
                profile = next((item for item in self._state["profiles"] if item["accountId"] == user["id"]), None)
                if profile is not None:
                    profile["personalDetails"] = user["personalDetails"]
                    profile["onboarding"] = user["onboarding"]
            self._write()
        return user

    def list_users(self):
        return list(self._state["users"])

    # Account / Profile / Authenticator (password milestone).

    def _compose_user_dto(self, account, profile):
        return {
            "id": account["id"],
            "roles": account["roles"],
            "status": account["status"],
            "personalDetails": profile["personalDetails"],
            "onboarding": profile["onboarding"],
            "createdAt": account["createdAt"],
        }

    def find_login_identifier(self, identifier_type, value):
        return next(
            (
                item
                for item in self._state["loginIdentifiers"]
                if item["type"] == identifier_type and item["value"] == value
            ),
            None,
        )

    def find_authenticator(self, account_id, authenticator_type):
        return next(
            (
                item
                for item in self._state["authenticators"]
                if item["accountId"] == account_id and item["type"] == authenticator_type
            ),
            None,
        )

    def create_password_account(self, account, profile, identifier, authenticator):
        with self._lock:
            if self.find_login_identifier(identifier["type"], identifier["value"]) is not None:
                raise DuplicateLoginIdentifier(identifier["value"])
            self._state["accounts"].append(account)
            self._state["profiles"].append(profile)
            self._state["loginIdentifiers"].append(identifier)
            self._state["authenticators"].append(authenticator)
            self._write()
        return self._compose_user_dto(account, profile)

    def list_accounts(self):
        return list(self._state["accounts"])

    # Journey.

    def list_journeys(self, user_id):
        return [item for item in self._state["journeys"] if item["userId"] == user_id]

    def find_active_journey(self, user_id, experience_id):
        return next(
            (
                item
                for item in self._state["journeys"]
                if item["userId"] == user_id and item["experienceId"] == experience_id and item["status"] == "active"
            ),
            None,
        )

    def find_journey_for_activity(self, user_id, activity_id):
        return next(
            (
                item
                for item in self._state["journeys"]
                if item["userId"] == user_id and activity_id in item["activityIds"]
            ),
            None,
        )

    def create_journey(self, journey):
        with self._lock:
            self._state["journeys"].append(journey)
            self._write()
        return journey

    def update_journey(self, journey):
        self._save()
        return journey

    # Interest.

    def list_interests(self, user_id):
        return [item for item in self._state["interests"] if item["userId"] == user_id]

    def find_interest(self, user_id, experience_id):
        return next(
            (
                item
                for item in self._state["interests"]
                if item["userId"] == user_id and item["experienceId"] == experience_id
            ),
            None,
        )

    def create_interest(self, interest):
        with self._lock:
            self._state["interests"].append(interest)
            self._write()
        return interest

    # Lifecycle.

    def reset(self):
        with self._lock:
            self._state = copy.deepcopy(INITIAL_RUNTIME_STATE)
            self._write()
