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

Within Identity, an **Account** is the unique loggable environment and authorization principal, while a **Profile** contains the person's facts. Login identifiers locate an Account; authenticators such as a password or future passkey prove control. Mobile numbers and email addresses are Profile contact points and are not considered verified merely because they were entered.

Discovery is a page and use case, not a fourth feature. It composes Experience catalogue data with Journey participation state. Similarly, an activity page combines an Experience activity definition with the learner's Journey state.

## How the MyGita client is organized

```text
mygita/src/
├── core/
│   ├── ui/                # domain-agnostic atomic UI
│   └── components/        # domain-agnostic composite UI
├── contracts/             # HTTP contract adapter and generated validators
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
                                      └───────→ API provider → contract adapter → mygita.api
```

Pages may compose multiple features, but they must use feature `index.js` entry points. They must not import fixture providers, API providers, transport code, or private feature modules. Features may use `core`, but they do not depend on pages or reach into other features. `core` remains domain-agnostic.

The repository interface is the stable contract between UI composition and data access. Repository methods are asynchronous even when backed by local fixtures. Fixture and API implementations can therefore be selected without redesigning pages.

## Safety and contracts

There are two different kinds of boundary:

1. **Inside the client:** checked JavaScript and JSDoc repository interfaces provide design-time safety. Runtime schema validation is not duplicated across this trusted boundary.
2. **Across HTTP:** OpenAPI 3.1 defines the authoritative client/server contract. Generated validators check API responses when they enter the client contract adapter, before repositories expose normalized domain data.

The browser can communicate with `mygita.api` through explicit provider selection, while fixtures remain the default. In the target product architecture, MyGita's server will communicate with product-specific APIs such as `gita4children.api` and `gitasara.api`. Product API contracts stay product-specific; common concepts provide consistency without forcing different learning models into one generic API.

API identities use dots in prose. Their filesystem directories use hyphens—for example, `gitasara.api` and `gitasara-api`.

## What exists today

- The Landing region is a responsive static page with externalized CSS and progressively loaded images.
- MyGita is a dependency-free browser application using native ES modules.
- MyGita has working discovery, experience detail, batch selection, interest registration, simulated OTP, onboarding, journey, activity, profile, review, and system-state screens.
- Pages work through asynchronous Identity, Experience, and Journey repositories.
- Username/password Account creation and login are the primary Identity UI; Profile setup is optional and can be resumed later.
- Repositories have fixture and API providers; fixtures remain the default and persist prototype state in `sessionStorage`.
- Checked-JavaScript analysis, repository-contract tests, fixture-integrity tests, and architecture import-boundary tests are available.
- Repository-boundary Phase 1 is complete.
- A local Python mock API supports the API-backed development mode.
- API transport, bearer-session handling, runtime response validation, normalization, and explicit provider selection are implemented.
- The OpenAPI 3.1 `mygita.api` contract covers every current mock API operation; version 0.2 defines password Account creation and login, now implemented at the client boundary with server integration in progress.
- A complete Gita Sāra flow is tested through the API providers and mock server.

The prototype OTP compatibility option is `123456`. It is not the primary UI or a production authentication mechanism.

### Fixture independence

The browser fixtures and mock-server seed data remain intentionally independent. They share stable identifiers, but the browser defines three concrete Gita Sāra activities plus placeholders while the mock server defines twelve concrete activities. OpenAPI and runtime-validated adapters now make the server boundary explicit instead of treating the two fixture shapes as an implicit contract.

## What is intentionally deferred

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

For API-backed local development, also run `python3 mygita-server/dev_server.py` and open `http://127.0.0.1:8000/mygita/?provider=api`.

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
- [Identity architecture](architecture/identity.md) separates the loggable Account from Profile facts and authentication methods.
- [Product integration](architecture/product-integration.md) explains how MyGita and learning products differ and connect.
