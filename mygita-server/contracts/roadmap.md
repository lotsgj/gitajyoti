# Roadmap

Design changes and ideas under consideration for `mygita-server` that are not yet a made change
(see `changes.md`) and not yet an ADR-worthy proposal (see `suggestions.md`). Contract-edit ideas
live here too, distinct from `suggestions.md`, which is ADR rationale only.

## Status

`NEW` — raised, not started · `DEFERRED` — considered, intentionally postponed · `DONE` — carried
out (moved to `changes.md` and, if ADR-worthy, promoted to `suggestions.md`) · `REJECTED` — considered
and declined, with reason noted.

---

### 1. Constrain `Experience.slug` / `ExperienceId` to a stable pattern

**Status: NEW** (raised 2026-09-10)

`openapi.yaml` types `Experience.slug` and the `ExperienceId` path parameter as bare
`{ type: string, minLength: 1 }`. Every seed slug is lowercase kebab-case and both the client and
server already treat it as a URL-safe token. Proposed: add
`pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'` to `Experience.slug` (leave `ExperienceId` unconstrained
since it intentionally accepts either the opaque `id` or the `slug`). This is a contract edit, not
mine to make directly — for codex to pick up if it agrees.

### 2. Close the live-reference / non-atomic update gap in `JsonStore`

**Status: DONE, but only for `SqliteStore` — `JsonStore` itself still has the gap** (raised by
[ADR-0009](../../docs/gitajyoti/decisions/ADR-0009-server-persistence-boundary.md)'s own
consequences section, 2026-09-11; closed 2026-09-11, see `changes.md`)

ADR-0009 records that `JsonStore` returns live dictionary references, and that `update_user` /
`update_journey` persist mutations the caller already made to that live object before the store's
lock is acquired — so two concurrent updates to the same user or journey can still interleave. The
specific manifestation this item was really about — a duplicate active Journey or duplicate
Interest slipping through a race — is now closed by `SqliteStore`'s real database constraints (a
partial unique index on `journeys(user_id, experience_id) WHERE status='active'`, and a unique
constraint on interests), verified by bypassing the application-level pre-check entirely and
hitting the constraints directly. **This is not universally closed**: `dev_server.py` still
defaults to `JsonStore`, which retains the original live-reference gap for `update_user` /
`update_journey` specifically (as opposed to the create-race this note focused on). Fully closing
that remaining piece, or retiring `JsonStore`, is not scheduled.

### 2b. Close the remaining live-reference gap in `JsonStore.update_user`/`update_journey`

**Status: NEW** (split out 2026-09-11 from item 2 above, once SqliteStore closed the create-race
half of it)

Unlike the create-race above (now closed via `SqliteStore`'s constraints), `JsonStore.update_user`
and `update_journey` still persist mutations the caller already made to a live returned object
before the store's lock is acquired — a narrower, harder-to-hit race (concurrent profile/onboarding
edits, or concurrent activity completions on the same Journey) that `SqliteStore`'s constraints
don't address since there's no uniqueness invariant to enforce, just an ordering one. Closing it
means either the store deep-copies on read and merges an explicit patch on write, or the request
path holds a lock across read-mutate-write. Only matters for `JsonStore`, since `SqliteStore`'s
per-operation `UPDATE` statements are already atomic. Low priority while `JsonStore` remains a
single-process, low-traffic default.

### 3. Multi-method sign-in: Google, Microsoft, email/password alongside mobile OTP

**Status: password/email piece DONE (2026-09-11, via ADR-0010's Account/Profile/LoginIdentifier/
Authenticator model — `POST /auth/accounts`, `POST /auth/password/login`, see `changes.md`);
Google/Microsoft and the identity-linking design below remain NEW, not started.**

The Account/LoginIdentifier/Authenticator shape recommended in this item is exactly what ADR-0010
specified and what got built — `loginIdentifiers`/`authenticators` rows keyed by type, not `users`
columns — so the convergence goal below is already realized for password vs. mobile OTP (both
resolve through `find_user`/`_issue_session`). Google and Microsoft sign-in, and the identity-linking
endpoints, are unbuilt and blocked on a contract addition (see "still open" below) codex hasn't
picked up yet.

Decision recommended: client-side SDK per provider (Google Identity Services, MSAL.js) obtains a
provider-signed ID token; backend only verifies that token's signature against the provider's JWKS
(`aud`/`iss`/`exp` checked, token discarded after use, never persisted) and then find-or-creates the
local user and issues the same local session JWT `/auth/otp/verify` already issues. Rejected:
backend-driven OAuth Authorization Code flow with server-held provider tokens — unnecessary here
since nothing calls Google/Microsoft APIs on the user's behalf; that's a distinct, additive feature
if it's ever needed, not part of sign-in itself. Email/password is backend-only by necessity (hash
comparison), no provider involved.

All four methods (mobile OTP, Google, Microsoft, password) converge on the same internal seam:
verify a proof of identity → find-or-create local user → issue local JWT. Should factor a shared
`complete_sign_in(claim)` step behind per-method verifiers, mirroring the `Store` abstraction
pattern, rather than duplicating find-or-create/issue-token logic four times.

**Identity-linking pattern (resolved 2026-09-11, design only):** a `users` table (canonical
account) plus an `identities` table keyed `(provider, subject) → user_id` — mobile, Google,
Microsoft, and password each become a row rather than a `users` column. Recommended policy:
**explicit linking only** — sign-in never auto-merges across providers, even on a verified-email
match; it points the user to sign in with their original method and link the new one from an
authenticated profile action (`POST /me/identities/{method}/link`, requires an active session,
`409` if that identity already belongs to someone else). Alternative considered and not chosen by
default: "soft auto-link on verified email + notify," lighter UX, weaker guarantee — worth
revisiting if linking friction turns out to matter more than the account-takeover-by-linking risk
it avoids. Either policy: never treat an email claim as a linking signal unless `email_verified` is
true on that token.

Still open: the new endpoints (`/auth/google/verify`, `/auth/microsoft/verify`,
`/auth/password/register`, `/auth/password/verify`, `/me/identities`,
`/me/identities/{method}/link`) are `openapi.yaml` additions — for codex to pick up, not mine to add
directly.

### 4. `SqliteStore` behind the existing `Store` interface (hybrid ER + JSON schema)

**Status: DONE** (design discussion 2026-09-11; implemented 2026-09-11, see `changes.md` 17:45 UTC
entry and `api/sqlite_store.py`)

Built as designed: `sqlite3` (stdlib — no new dependency), hybrid schema — real columns/indexes/FKs
only for what's joined, filtered, or constrained; everything nested/variable-shaped stays a JSON
column. The partial unique index on `journeys(user_id, experience_id) WHERE status='active'`
predicted here did close item 2's create-race half, as anticipated. Selected via
`dev_server.py --store sqlite`; `JsonStore` remains the default (see item 2's note — that's the one
remaining reason the live-reference gap isn't universally closed). No new roadmap item needed for
this decision — see `suggestions.md` item 1's reconciliation note for why it didn't need its own
ADR either (ADR-0009 already anticipated exactly this).
