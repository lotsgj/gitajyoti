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


class DuplicateLoginIdentifier(Exception):
    """Raised by `create_password_account` when the login identifier it was
    asked to attach (e.g. a normalized username) already resolves to a
    different Account. The check and the insert happen atomically inside the
    store so this can never be a check-then-act race."""


class DuplicateActiveJourney(Exception):
    """Raised by `create_journey` when the (user, experience) pair already
    has an active journey.

    This is a defense-in-depth backstop, not the primary check: callers are
    still expected to call `find_active_journey` first for a friendly error.
    A store without real transactional/constraint support (e.g. `JsonStore`)
    cannot enforce this atomically and does not raise it; a store that can
    (e.g. a SQL-backed one, via a unique constraint) should, so the rare
    race a plain pre-check cannot close is still caught."""


class DuplicateInterest(Exception):
    """Raised by `create_interest` when the (user, experience) pair already
    has an interest registration. Same defense-in-depth role as
    `DuplicateActiveJourney`."""


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
        """Return a user by id, or None.

        Resolves either the legacy (mobile-OTP) `users` collection or an
        Account+Profile pair, composed into the same User-compatible shape,
        transparently. Callers never need to know which one a given id is."""

    @abstractmethod
    def find_user_by_mobile(self, mobile):
        """Return a legacy (mobile-OTP) user by mobile number, or None."""

    @abstractmethod
    def create_user(self, user):
        """Persist a new legacy (mobile-OTP) user and return it."""

    @abstractmethod
    def update_user(self, user):
        """Persist changes already made to a user and return it.

        Resolves back to whichever collection the user actually came from
        (legacy `users`, or an Account's Profile) transparently."""

    @abstractmethod
    def list_users(self):
        """Return every legacy (mobile-OTP) user. Diagnostic/test use only."""

    # Account / Profile / Authenticator (password milestone; see ADR-0010).
    #
    # An Account is the loggable principal; a Profile holds personal facts
    # and is created pending alongside the Account; a login identifier
    # (username, for now) locates an Account; an Authenticator proves control
    # of it. These are separate collections from the legacy `users` above by
    # design, so a future identifier/authenticator type (mobile, Google,
    # Microsoft) is a new row shape, not a schema change. `find_user` and
    # `update_user` above already resolve Account-backed users transparently
    # for every other feature (Journey, Interests, Profile).

    @abstractmethod
    def find_login_identifier(self, identifier_type, value):
        """Return {'type', 'value', 'accountId'} for a login identifier, or None."""

    @abstractmethod
    def find_authenticator(self, account_id, authenticator_type):
        """Return the authenticator row for (account_id, authenticator_type), or None."""

    @abstractmethod
    def create_password_account(self, account, profile, identifier, authenticator):
        """Atomically persist a new Account, its pending Profile, its login
        identifier, and its password Authenticator, then return the composed
        User-compatible DTO.

        Raises DuplicateLoginIdentifier if `identifier` already resolves to a
        different Account; the uniqueness check and the insert happen under
        the same lock, so this can never be a check-then-act race."""

    @abstractmethod
    def list_accounts(self):
        """Return every password-backed Account. Diagnostic/test use only."""

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

    @abstractmethod
    def close(self):
        """Release any resources the store holds (e.g. a database
        connection). Safe to call more than once. A no-op for a store that
        holds nothing to release."""
