# Roadmap

## Phase 0 — Site and prototype foundation

Status: Complete

- Landing region and MyGita navigation
- Fixture-driven MyGita screen map
- Local MyGita mock API and tests

## Phase 1 — Repository boundary

Status: Complete

- UI-to-repository contracts
- Identity, Experience, and Journey feature boundaries
- Route-level pages composed outside features
- Fixture-backed repositories
- UI migration away from direct fixture access
- Repository contract and fixture-integrity tests

Implemented: feature/page boundaries, checked-JavaScript repository contracts, fixture providers, page migration, route-level loading and failure states, and automated contract/integrity/boundary tests. Running these checks in CI remains a cross-cutting implementation-checklist item.

## Phase 2 — MyGita API contract

Status: Planned

- `mygita.api` OpenAPI specification
- API adapters and runtime response validation
- API-backed repositories
- One complete Gita Sāra vertical slice

## Phase 3 — Product integration

Status: Planned

- Common product-integration concepts
- Product-specific API contracts
- Secure launch, enrolment provisioning, and progress synchronization

## Phase 4 — Production readiness

Status: Deferred

- Production identity, OTP, database, hosting, observability, privacy, consent, safeguarding, and approved learning content
