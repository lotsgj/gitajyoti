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

**Status: NEW** (raised by [ADR-0009](../../docs/gitajyoti/decisions/ADR-0009-server-persistence-boundary.md)'s
own consequences section, 2026-09-11)

ADR-0009 records that `JsonStore` returns live dictionary references, and that `update_user` /
`update_journey` persist mutations the caller already made to that live object before the store's
lock is acquired — so two concurrent updates to the same user or journey can still interleave.
Closing this means either the store deep-copies on read and merges an explicit patch on write, or
the whole request-handling path holds a lock across read-mutate-write. Server-internal fix, no
contract or docs impact expected — will fold into `changes.md` when done, and only needs a
`suggestions.md` entry if the fix changes the shape of the `Store` interface itself.

### 3. Multi-method sign-in: Google, Microsoft, email/password alongside mobile OTP

**Status: NEW** (design discussion 2026-09-11, no code written)

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

**Status: NEW** (design discussion 2026-09-11, no code written)

Evaluated file-based persistence options for a "few-thousand-users, no dedicated data store yet"
stage. Recommendation: `sqlite3` (stdlib — no new dependency), with a **hybrid** schema rather than
either a single JSON blob per collection or full 3NF normalization — real columns and indexes/FKs
only for what's joined, filtered, or constrained (`id`, `slug`, `status`, `user_id`,
`experience_id`, `mobile`), everything nested/variable-shaped (`personalDetails`,
`intendedOutcomes[]`, `activityIds[]`) stays a JSON column. A partial unique index on
`journeys(user_id, experience_id) WHERE status='active'` would additionally let the database enforce
the duplicate-enrolment invariant directly, closing item 2 above as a side effect if built after it
— or item 2's fix may make this less urgent if done first. Order between items 2 and 3 not yet
decided. No commitment yet to build this; `JsonStore` remains the default until there's an actual
concurrency or scale trigger.
