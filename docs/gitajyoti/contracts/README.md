# Contracts

Contracts define boundaries between independently changing components.

- UI-to-repository interfaces are internal checked-JavaScript declarations.
- `mygita.api` is the client/server HTTP contract and will be specified with OpenAPI.
- Product-specific APIs define MyGita server integrations with learning products.
- Runtime schema validation belongs at API adapter boundaries, not between trusted UI and repository modules.

API identities use dots in prose and diagrams. Contract directories use hyphens on the filesystem.
