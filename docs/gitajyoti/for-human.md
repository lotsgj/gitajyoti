# Gita Jyoti — for humans

This is the shortest path to understanding the design of this repository: what Gita Jyoti is, how its parts relate, what is implemented now, and which boundaries future work must preserve.

## The mental model

**Gita Jyoti is the complete site.** It currently contains two **regions**:

- **Landing** introduces Gita Jyoti publicly and leads visitors into MyGita.
- **MyGita** is the learner-facing region for discovering learning opportunities, establishing identity, enrolling, and returning to ongoing learning.

A region is a major area of the site with its own purpose and user journey. It is not a geographic or infrastructure region.

Gita Jyoti also connects to independently evolving **products**, such as Gita for Children and Gita Sāra. Products deliver specialized curricula and learning interactions. They are not internal MyGita features.

An **experience** is an enrolable learning offering shown in MyGita. A product may deliver one or more experiences.

```text
Gita Jyoti site
├── Landing region
└── MyGita region
    ├── discover experiences
    ├── establish learner identity
    ├── enrol and return to a journey
    └── launch learning products and aggregate progress

Learning products
├── Gita for Children     → gita4children.app
├── Gita Sāra             → gitasara.app
├── Pūrṇa Yoga Darśana    → future product application
└── Gita Yoga             → future product application
```

## What MyGita owns

MyGita is an orchestration region, not a container for every learning implementation. Its client is organized around three domain features:

- **Identity** owns authentication, session, learner identity, profile, roles, and identity-level authorization information.
- **Experience** owns the catalogue, experience details, batches, availability, product association, and reusable activity definitions supplied by an experience or product.
- **Journey** owns a learner's enrolment and participation, current and next activity, progress, completion, and product-launch state.

Authorization is not centralized blindly under Identity. The feature that owns a resource remains responsible for its resource-specific authorization rules.

Discovery is a page and use case, not a fourth feature. It composes Experience catalogue data with Journey participation state. Similarly, an activity page combines an Experience activity definition with the learner's Journey state.

## How the MyGita client is organized

```text
mygita/src/
├── core/
│   ├── ui/                # domain-agnostic atomic UI
│   └── components/        # domain-agnostic composite UI
├── features/
│   ├── identity/
│   ├── experience/
│   └── journey/
├── pages/                 # route-level screen compositions
└── shell/                 # MyGita navigation and application chrome
```

The dependency direction is deliberate:

```text
page → feature public entry point → repository → fixture provider
                                      └───────→ future API provider
```

Pages may compose multiple features, but they must use feature `index.js` entry points. They must not import fixture providers, future API providers, transport code, or private feature modules. Features may use `core`, but they do not depend on pages or reach into other features. `core` remains domain-agnostic.

The repository interface is the stable contract between UI composition and data access. Repository methods are asynchronous even when backed by local fixtures, allowing a future API provider to replace a fixture provider without redesigning the pages.

## Safety and contracts

There are two different kinds of boundary:

1. **Inside the client:** checked JavaScript and JSDoc repository interfaces provide design-time safety. Runtime schema validation is not duplicated across this trusted boundary.
2. **Across HTTP:** OpenAPI 3.1 will define the authoritative client/server contract. API responses will be runtime-validated when they enter client API adapters, before repositories expose normalized domain data.

In the target architecture, the browser will communicate with `mygita.api`. The current browser is fixture-backed and is not connected to that server. MyGita's server will communicate with product-specific APIs such as `gita4children.api` and `gitasara.api`. Product API contracts stay product-specific; common concepts provide consistency without forcing different learning models into one generic API.

API identities use dots in prose. Their filesystem directories use hyphens—for example, `gitasara.api` and `gitasara-api`.

## What exists today

- The Landing region is a responsive static page with externalized CSS and progressively loaded images.
- MyGita is a dependency-free browser application using native ES modules.
- MyGita has working discovery, experience detail, batch selection, interest registration, simulated OTP, onboarding, journey, activity, profile, review, and system-state screens.
- Pages work through asynchronous Identity, Experience, and Journey repositories.
- Repositories currently use fixture providers and persist prototype state in `sessionStorage`.
- Checked-JavaScript analysis, repository-contract tests, fixture-integrity tests, and architecture import-boundary tests are available.
- Repository-boundary Phase 1 is complete.
- A local Python mock API exists separately, but the browser does not use it.
- API client, session, and configuration scaffolding remains in place intentionally for the future API-provider phase; current pages do not import it.
- The OpenAPI 3.1 `mygita.api` contract covers every mock API operation and is checked against documented examples and captured mock responses.

The prototype OTP is `123456`. It is not a production authentication mechanism.

### Fixture independence

The browser fixtures and mock-server seed data are intentionally independent at this stage. They share the identifiers required for the prototype, but the browser currently defines three concrete Gita Sāra activities plus placeholders while the mock server defines twelve activities. This difference is tracked as test data, not treated as an implicit API contract. OpenAPI, API-adapter normalization, runtime validation, and compatibility tests must establish that contract before the browser is connected to the server.

## What is intentionally deferred

- Client API providers and provider selection.
- Runtime validation and normalization in API adapters.
- Production identity, OTP, persistence, hosting, privacy, consent, safeguarding, and retention decisions.
- Secure product launch, enrolment provisioning, and progress synchronization.
- Production product applications, curricula, media, and artwork.

These are planned boundaries, not capabilities that should be inferred from the current prototype.

## Running and checking the site

Serve the repository over HTTP because MyGita uses browser ES modules:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/` for Landing or `http://127.0.0.1:8000/mygita/` for MyGita.

Development dependencies live outside the browser application:

```sh
cd dev-tools
pnpm install --frozen-lockfile
pnpm run check
```

`dev-tools/node_modules` is generated and ignored by Git. `dev-tools/package.json` and `dev-tools/pnpm-lock.yaml` are committed so another machine can recreate the same toolchain.

## Where to go next

- [Current state](current-state.md) records what is implemented.
- [Roadmap](roadmap.md) describes the delivery sequence.
- [Implementation checklist](implementation-checklist.md) tracks individual work items.
- [Architecture decisions](decisions/README.md) preserve why important choices were made.
- [Glossary](glossary.md) defines the shared language.
- [System context](architecture/system-context.md) gives the concise ecosystem view.
- [Repository boundaries](architecture/repository-boundaries.md) defines the UI/data-access seam.
- [Product integration](architecture/product-integration.md) explains how MyGita and learning products differ and connect.
