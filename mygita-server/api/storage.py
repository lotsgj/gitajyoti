"""JSON seed and runtime persistence for the local mock API."""

import copy
import json
import os
import tempfile
import threading


INITIAL_RUNTIME_STATE = {
    "users": [],
    "journeys": [],
    "interests": [],
}


class JsonStore:
    def __init__(self, seed_dir, runtime_dir):
        self.seed_dir = seed_dir
        self.runtime_dir = runtime_dir
        self.state_path = os.path.join(runtime_dir, "state.json")
        self._lock = threading.RLock()
        os.makedirs(runtime_dir, exist_ok=True)
        self.experiences = self._load_seed("experiences.json")
        self.activities = self._load_seed("activities.json")
        self.batches = self._load_seed("batches.json")
        self.sessions = self._load_seed("sessions.json")
        self.state = self._load_runtime()

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
        data = state if state is not None else self.state
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

    def save(self):
        with self._lock:
            self._write()

    def reset(self):
        with self._lock:
            self.state = copy.deepcopy(INITIAL_RUNTIME_STATE)
            self._write()

    def find_user_by_mobile(self, mobile):
        return next((user for user in self.state["users"] if user["personalDetails"].get("mobile") == mobile), None)

    def find_user(self, user_id):
        return next((user for user in self.state["users"] if user["id"] == user_id), None)

    def find_experience(self, identifier):
        return next((item for item in self.experiences if item["id"] == identifier or item["slug"] == identifier), None)
