# Architecture decision register

This register is the human-facing source for the decisions currently in force. Start here instead of inferring the current architecture from ADR numbers or reading every historical record.

## Effective decisions by area

| Decision area | Effective ADRs | Implementation | Relationship |
| --- | --- | --- | --- |
| Site vocabulary and boundaries | [ADR-0001](ADR-0001-gitajyoti-system-boundaries.md) | Implemented | — |
| MyGita's role | [ADR-0002](ADR-0002-mygita-as-orchestration-region.md) | Partial | Product launch and aggregated product progress remain future work. |
| Product documentation ownership | [ADR-0003](ADR-0003-learning-products-as-first-class-products.md) | Implemented | — |
| MyGita client architecture | [ADR-0004](ADR-0004-ui-repository-boundary.md), [ADR-0008](ADR-0008-mygita-feature-and-page-composition.md) | Implemented | ADR-0008 refines ADR-0004; both remain effective. |
| MyGita client/server boundary | [ADR-0005](ADR-0005-openapi-client-server-contract.md), [ADR-0006](ADR-0006-runtime-validation-boundary.md) | Implemented | ADR-0006 defines where ADR-0005 responses are validated. |
| Product API boundaries | [ADR-0007](ADR-0007-product-specific-api-contracts.md) | Planned | Applied when the first product integration is designed. |
| MyGita server persistence | [ADR-0009](ADR-0009-server-persistence-boundary.md) | Partial | Store injection exists; value isolation and atomic updates remain. |

## ADR lifecycle register

| ADR | Lifecycle | Implementation | Supersedes | Superseded by |
| --- | --- | --- | --- | --- |
| [ADR-0001: Gita Jyoti system boundaries](ADR-0001-gitajyoti-system-boundaries.md) | Accepted | Implemented | — | — |
| [ADR-0002: MyGita as an orchestration region](ADR-0002-mygita-as-orchestration-region.md) | Accepted | Partial | — | — |
| [ADR-0003: Learning products as first-class products](ADR-0003-learning-products-as-first-class-products.md) | Accepted | Implemented | — | — |
| [ADR-0004: UI-to-repository boundary](ADR-0004-ui-repository-boundary.md) | Accepted | Implemented | — | — |
| [ADR-0005: OpenAPI client/server contract](ADR-0005-openapi-client-server-contract.md) | Accepted | Implemented | — | — |
| [ADR-0006: Runtime validation boundary](ADR-0006-runtime-validation-boundary.md) | Accepted | Implemented | — | — |
| [ADR-0007: Product-specific API contracts](ADR-0007-product-specific-api-contracts.md) | Accepted | Planned | — | — |
| [ADR-0008: MyGita feature and page composition](ADR-0008-mygita-feature-and-page-composition.md) | Accepted | Implemented | — | — |
| [ADR-0009: Server persistence boundary](ADR-0009-server-persistence-boundary.md) | Accepted | Partial | — | — |

## How to read status

Lifecycle and implementation are separate:

- **Proposed** means the decision is under consideration.
- **Accepted** means the decision governs current and future work; it does not mean implementation is complete.
- **Superseded** means another ADR has replaced the decision. The replacement is named in both records and in this register.
- **Deprecated** means the decision should no longer guide new work and has no direct replacement.
- **Planned** means implementation has not started.
- **Partial** means some required behavior exists and the remaining work is identified in the ADR or implementation checklist.
- **Implemented** means the currently agreed scope is present and verified.

An ADR that adds detail without invalidating an earlier decision **refines** or **complements** it; it does not supersede it. ADR numbers indicate recording order, not precedence.

## Maintenance rule

Every ADR must state `Status`, `Implementation`, `Supersedes`, and `Superseded by`. When a decision changes, create a new ADR, update both ADRs' lifecycle metadata, and update both tables above. Do not silently rewrite the old decision.
