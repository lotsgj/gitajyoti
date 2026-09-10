# ADR-0008: MyGita feature and page composition

Status: Accepted  
Date: 2026-09-10

## Context

MyGita screens commonly combine several domain capabilities. For example, discovery presents Experience catalogue data together with Journey enrolment state, while enrolment can also require Identity state. Making each page belong to one feature would blur domain ownership or force one feature to coordinate other features.

The earlier prototype also treated Activity as a separate feature. In the intended domain, learner-specific activity state is part of a learner's Journey, while reusable activity definitions belong to an Experience or its product.

## Decision

MyGita has three initial domain features:

- **Identity** owns authentication, session, learner identity, profile, roles, and identity-level authorization information.
- **Experience** owns the catalogue of enrolable learning offerings, experience details, batches, availability, and product association.
- **Journey** owns a learner's participation in experiences, including enrolment, current and next activity, progress, completion, and product launch state.

Resource-specific authorization remains enforced by the feature that owns the resource; Identity does not absorb every authorization rule.

Pages are route-level compositions outside the feature directories. A page may combine multiple features through their public interfaces and components. Pages must not import fixture providers, API providers, transport details, or private feature modules.

The client source is organized into these layers:

```text
mygita/src/
├── core/                  # stable, domain-agnostic foundations
│   ├── ui/                # atomic UI primitives
│   └── components/        # domain-agnostic composite UI blocks
├── features/
│   ├── identity/
│   ├── experience/
│   └── journey/
├── pages/                 # route-level, cross-feature screen composition
└── shell/                 # MyGita application chrome and layout
```

Each feature may own its domain models, checked-JavaScript contracts, repository interface, fixture and future API providers, operations, errors, and domain-aware components. Each feature exposes a public entry point. Cross-feature workflows are composed by pages or an explicit application-level coordinator, not by reaching into another feature's private modules.

Dependencies follow these rules:

- `core` is domain-agnostic and does not depend on features or pages.
- `core/ui` uses only core foundations.
- `core/components` composes `core/ui` and other core facilities.
- Features may use core facilities but do not depend on pages.
- Feature components understand their own domain only.
- Pages use feature public entry points and components, never concrete fixture or API providers.
- `shell` provides MyGita-specific application structure and may compose core building blocks.

Tests mirror architectural responsibility rather than the source tree mechanically:

```text
mygita/tests/
├── core/
├── core-components/
├── features/
├── feature-components/
├── fixtures/
├── pages/
├── flows/
└── contracts/             # introduced with external contract implementations
```

Feature tests cover domain behavior and repository contracts. Component tests cover isolated UI behavior. Page tests cover screen composition. Flow tests cover user goals across pages and features.

## Consequences

- Discovery is a page/use case, not a fourth domain feature.
- Activity is not a standalone initial repository. Experience owns reusable definitions; Journey owns learner activity state.
- Pages can mix several features without transferring domain ownership to the page.
- Feature public entry points become enforced dependency boundaries.
- `core` must remain domain-agnostic and must not become a miscellaneous shared-code directory.

## Relationship to earlier decisions

This decision refines [ADR-0004](ADR-0004-ui-repository-boundary.md). It preserves the UI-to-repository rule while defining the initial feature boundaries and locating cross-feature page composition outside those features.
