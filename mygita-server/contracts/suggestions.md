# Suggestions for codex

Tracks **design changes already made in `mygita-server`** that are architecturally significant
enough to warrant an ADR in `docs/gitajyoti/decisions/`. This file does not propose contract edits
or capture open ideas — see `mygita-server/contracts/roadmap.md` for those. Codex owns filing and
numbering the ADR; I only write the rationale here.

## Status

`NEW` — change made, no matching ADR seen yet · `DEFERRED` — change made, ADR deliberately held back
· `DONE` — an accepted ADR exists that covers this change · `REJECTED` — change was reverted or the
ADR explicitly declined it.

I reconcile status against `docs/gitajyoti/decisions/` every time I edit this file — an entry
should never sit at `NEW` from a stale check.

---

## 1. Persistence abstraction boundary

**Status: DONE** — [ADR-0009: Server persistence boundary](../../docs/gitajyoti/decisions/ADR-0009-server-persistence-boundary.md), Accepted 2026-09-11.

**Change made (2026-09-11):** Introduced `api/store.py` — an abstract `Store` interface — and
rewrote `api/app.py` handlers and `api/storage.py`'s `JsonStore` so the application depends only on
`Store`'s methods, never on a concrete store's internal representation or a whole-graph `save()`.
See `changes.md`, 2026-09-11 entry, for the full change list.

**Reconciliation note (updated 2026-09-11):** ADR-0009's decision and consequences match the change
as built. Its own text already anticipated the next step taken since — *"A database-backed
implementation can be introduced at the composition root without rewriting handlers or changing the
public API"* — which is exactly what `api/sqlite_store.py` (`SqliteStore`) now is; no new ADR
proposed for that, since it's implementation of this ADR's own decision, not a new one. One
correction to this note: the live-reference/non-atomic-update gap ADR-0009's consequences section
flagged is now closed **for whichever store is selected** — `SqliteStore` enforces the
duplicate-active-journey and duplicate-interest invariants with real database constraints, not just
the application-level pre-check `JsonStore` relies on alone. `JsonStore` itself still has the
original gap; it remains the default in `dev_server.py`, so the gap is only closed once `sqlite` is
selected, not universally yet. See `changes.md`, 2026-09-11 17:45 UTC entry, for the full detail.

## 2. Password hashing: PBKDF2-HMAC-SHA256, not Argon2id or scrypt

**Status: NEW** — no ADR seen yet.

**Change made (2026-09-11):** `api/passwords.py` hashes passwords with `hashlib.pbkdf2_hmac('sha256',
...)` at 600,000 iterations, not Argon2id (`docs/gitajyoti/architecture/identity.md` handoff item 3's
named default) and not scrypt (this milestone's own first choice, implemented then replaced in the
same day).

**Why an ADR, not just an implementation footnote:** the deviation isn't discretionary tuning — it's
load-bearing. Argon2id has no Python stdlib implementation (would mean a new pip dependency, against
this server's dependency-free design). scrypt *is* stdlib (`hashlib.scrypt`) but was found to be
unavailable on two real deployment targets: Apple's bundled macOS Python (3.9.6, linked against
LibreSSL 2.8.3 — `hashlib.scrypt` doesn't exist at all, confirmed by actually running
`dev_server.py` under `/usr/bin/python3` and hitting `POST /auth/accounts`, not just an isolated
check) and PythonAnywhere (matching forum reports of `ValueError: unsupported hash type scrypt` on
their hosted Python images). PBKDF2-HMAC-SHA256 has been in `hashlib` since Python 3.4 with no
OpenSSL-scrypt dependency, and is OWASP's documented fallback when Argon2id/scrypt/bcrypt aren't
available. Full detail and reproduction steps: `changes.md`, 2026-09-11 09:10 UTC entry.

**Why this matters to codex:** `identity.md`'s handoff item 3 still names Argon2id as the default
with scrypt as the implied "equivalent" (per this session's own earlier framing) — a future reader
of that doc, or a future server implementation (production, not this mock), could reasonably pick
scrypt again without knowing it fails on real targets. Worth either an ADR recording the algorithm
choice and its portability rationale, or an amendment to `identity.md` item 3 naming PBKDF2 (or the
portability constraint itself) explicitly. I'm not proposing which — that's an ADR/docs judgment,
codex's call.
