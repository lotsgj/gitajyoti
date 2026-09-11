"""Abstract persistence boundary for the My Gita API.

`MyGitaApplication` depends only on this interface, never on a concrete
store's internal representation. Handlers read and write through these
methods; they never inspect or mutate a store's private state and never call
a whole-graph save. That is what lets `JsonStore` be replaced later by a
database-backed store (or anything else) without changing `api/app.py`.

See `mygita-server/contracts/suggestions.md` (proposed ADR-0009) for the
architectural rationale.
"""

from abc import ABC, abstractmethod


class Store(ABC):
    # Reference data (read-only, seeded).

    @abstractmethod
    def list_experiences(self):
        """Return published experiences, in catalogue order."""

    @abstractmethod
    def find_experience(self, identifier):
        """Return an experience by id or slug, in any status, or None."""

    @abstractmethod
    def list_batches(self, experience_id):
        """Return batches belonging to an experience."""

    @abstractmethod
    def find_batch(self, batch_id, experience_id):
        """Return a single batch belonging to an experience, or None."""

    @abstractmethod
    def list_activities(self, experience_id):
        """Return activity definitions belonging to an experience."""

    @abstractmethod
    def find_activity(self, activity_id):
        """Return a single activity definition, or None."""

    @abstractmethod
    def find_session(self, activity_id, batch_id):
        """Return the scheduled session for an activity within a batch, or None."""

    # Identity.

    @abstractmethod
    def find_user(self, user_id):
        """Return a user by id, or None."""

    @abstractmethod
    def find_user_by_mobile(self, mobile):
        """Return a user by mobile number, or None."""

    @abstractmethod
    def create_user(self, user):
        """Persist a new user and return it."""

    @abstractmethod
    def update_user(self, user):
        """Persist changes already made to a user and return it."""

    @abstractmethod
    def list_users(self):
        """Return every user. Diagnostic/test use only."""

    # Journey.

    @abstractmethod
    def list_journeys(self, user_id):
        """Return every journey belonging to a user."""

    @abstractmethod
    def find_active_journey(self, user_id, experience_id):
        """Return the user's active journey for an experience, or None."""

    @abstractmethod
    def find_journey_for_activity(self, user_id, activity_id):
        """Return the journey that owns an activity for a user, or None."""

    @abstractmethod
    def create_journey(self, journey):
        """Persist a new journey and return it."""

    @abstractmethod
    def update_journey(self, journey):
        """Persist changes already made to a journey and return it."""

    # Interest.

    @abstractmethod
    def list_interests(self, user_id):
        """Return every interest registration belonging to a user."""

    @abstractmethod
    def find_interest(self, user_id, experience_id):
        """Return an interest registration, or None."""

    @abstractmethod
    def create_interest(self, interest):
        """Persist a new interest registration and return it."""

    # Lifecycle.

    @abstractmethod
    def reset(self):
        """Clear all runtime (non-seed) data."""
