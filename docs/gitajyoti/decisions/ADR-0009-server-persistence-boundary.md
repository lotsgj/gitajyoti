# ADR-0009: Server persistence boundary

- Status: Accepted
- Implementation: Partial
- Supersedes: None
- Superseded by: None
- Date: 2026-09-11

## Context

The MyGita mock API began with HTTP handlers reading and mutating `JsonStore` collections directly and then flushing the complete object graph. That was adequate for a local prototype, but it coupled request handling to one persistence representation. Replacing JSON files with a relational database or another production store would therefore require handler changes as well as a new persistence implementation.

The HTTP boundary is already governed by the `mygita.api` OpenAPI contract. Persistence is a separate, internal server boundary and must be replaceable without changing that external contract.

## Decision

MyGita server application logic accesses persistence only through an explicit `Store` interface. The interface exposes intent-revealing reference-data, Identity, Journey, interest, and lifecycle operations rather than its underlying collections or generic whole-graph persistence methods.

The concrete store is supplied to the application at its composition root. The local server defaults to `JsonStore`; tests or future deployments may inject another implementation without changing HTTP handlers.

Store implementations own their persistence representation and transaction mechanics. They must not expose mutable references to internal state. Each mutation is committed atomically by the store operation that represents it; application code must not mutate persisted state first and ask the store to flush it afterward.

Application and domain logic continue to own validation, authorization, and business policy. Store queries may express policy-neutral selection intent, such as looking up an active Journey or listing the published Experience catalogue, but storage-specific details must not escape the boundary.

This interface is an internal server contract. It does not replace or extend the OpenAPI contract, and it does not require client repository changes.

## Consequences

- `JsonStore` is the local implementation of the persistence interface, not part of application behavior.
- A database-backed implementation can be introduced at the composition root without rewriting handlers or changing the public API.
- Reference seed data and mutable learner data can map independently to production reference and transactional storage.
- Every store implementation needs shared behavioral tests for query results, mutation semantics, isolation, and failure behavior.
- Interface growth must be driven by application intent and must avoid leaking a particular database or JSON layout.
- `SqliteStore` now demonstrates the boundary with durable local runtime data, relational uniqueness constraints, and shared behavior tests. It remains an opt-in local backend while `JsonStore` is the default.
- The current `JsonStore` boundary still needs value isolation and operation-level atomic mutation: returned dictionaries are live references, and `update_user` and `update_journey` persist mutations made before their locks are acquired.

## Relationship to earlier decisions

This decision complements [ADR-0005](ADR-0005-openapi-client-server-contract.md). ADR-0005 governs the external client/server contract; this ADR governs the internal boundary between server application logic and persistence.
