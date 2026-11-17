# Repository guidance

Before changing Gita Jyoti, read `docs/gitajyoti/README.md`, `docs/gitajyoti/current-state.md`, the relevant region or product documentation, and accepted decisions under `docs/gitajyoti/decisions/`.

Use these terms consistently:

- **Site:** Gita Jyoti as a whole.
- **Region:** a major area within the site, currently Landing or MyGita.
- **Product:** an independently evolving learning application such as Gita for Children or Gita Sāra.
- **Experience:** an enrolable learning offering presented through MyGita.

## Ownership
- Codex owns `website`.
- If you are Claude: read and analyse freely, but don't edit unless the user explicitly asks in the current conversation. Otherwise, page changes go in mygita's feature file (Open section, with an id and a status), following `mygita-app/context/README.md`, and reach Codex through the user.

## Layout
- `index.html`, `register.html`, `mygita.html`, `privacy.html`, `style/`, `assets/`: public Landing pages and registration (profile creation through `api-server`).
- `mygita/`: MyGita browser client (`src/`, `tests/`).
- `mygita-server/`: local Flask mock API for MyGita development only (port 8081, OTP `123456`). Not production.
- `contracts/mygita-api/openapi.yaml`: MyGita API contract.
- `dev-tools/`: build and verification scripts (pnpm). `dist/` is build output; don't edit it.
- `docs/gitajyoti/`: site docs, current state, decisions (ADRs).
- `.github/workflows/`: `verify.yml` (checks), `deploy-pages.yml` (deploy).

## Commands (run from `dev-tools/`)
- `pnpm check`: all checks. Narrower: `check:profile-registration`, `check:mygita`, `check:site-build`, `check:openapi`.
- `pnpm build:site`, `pnpm build:mygita`.
- After changing `openapi.yaml`: `pnpm generate:api-validators`.

## Milestones and decisions
When completing a milestone, update the current-state document and implementation checklist in the same commit. Add or supersede an ADR when an architectural decision changes. Do not make a product an internal MyGita component: MyGita integrates with products through explicit contracts.
