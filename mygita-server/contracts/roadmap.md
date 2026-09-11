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

### 3. `SqliteStore` behind the existing `Store` interface (hybrid ER + JSON schema)

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
