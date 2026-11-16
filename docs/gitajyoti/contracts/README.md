# Contracts

Contracts define boundaries between independently changing components.

- UI-to-repository interfaces are internal checked-JavaScript declarations.
- [`mygita.api`](../../../contracts/mygita-api/README.md) is the client/server HTTP contract and is specified with OpenAPI 3.1.
- [`public-profile-api.md`](public-profile-api.md) records the separately deployed public Profile and invitation contract used by `register.html`.
- Product-specific APIs define MyGita server integrations with learning products.
- Runtime schema validation belongs at API adapter boundaries, not between trusted UI and repository modules.

API identities use dots in prose and diagrams. Contract directories use hyphens on the filesystem.
