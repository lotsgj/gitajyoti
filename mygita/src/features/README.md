# Feature modules

The current MyGita domain features are Identity, Experience, and Journey. Each feature owns its domain models, contract, repository interface, providers, operations, errors, and domain-aware components, and exposes them through a public entry point.

Route-level screens belong in `src/pages`, where they may compose multiple features through those public entry points. Pages must not import concrete fixture or API providers or private feature modules. Automated import-boundary tests enforce these rules.

See [ADR-0008](../../../docs/gitajyoti/decisions/ADR-0008-mygita-feature-and-page-composition.md).
