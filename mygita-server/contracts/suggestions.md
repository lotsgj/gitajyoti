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

**Reconciliation note:** ADR-0009's decision and consequences match the change as built. It also
correctly flags a gap the change did not fully close — see roadmap item "Close the live-reference /
non-atomic update gap in `JsonStore`" in `roadmap.md`, opened from that ADR's own consequences
section rather than re-litigated here.
