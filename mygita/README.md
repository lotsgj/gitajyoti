# My Gita client

The client is a dependency-free, native ES-module application designed for GitHub Pages.

## Local preview

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/mygita/`. The client currently uses fixture-backed feature repositories; API-backed providers are deferred to a later vertical slice.

## Verification

Install repository development tools from the repository root:

```sh
cd dev-tools
pnpm install --frozen-lockfile
pnpm run check:mygita
```

The check runs TypeScript design-time analysis over the classic JavaScript client, repository and architecture contract tests, and fixture-integrity tests. Development dependencies are isolated under `dev-tools/node_modules` and are not required by the browser application.

## Boundaries

- `src/core`: domain-agnostic foundations, including atomic UI and reusable composite components.
- `src/features`: Identity, Experience, and Journey domain modules, exposed through public entry points.
- `src/pages`: route-level screens that compose one or more features.
- `src/shell`: MyGita application chrome and navigation.
- `styles`: global tokens, base rules, layout and shared components.

The fixture-backed implementation follows these boundaries; future API providers will implement the same feature repository contracts. See [ADR-0008](../docs/gitajyoti/decisions/ADR-0008-mygita-feature-and-page-composition.md).

`src/config.js`, `src/core/api-client.js`, and `src/core/session.js` are intentionally dormant scaffolding for that future API-provider work and are not part of the current fixture-backed import graph.
