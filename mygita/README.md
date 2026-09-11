# My Gita client

The client is a dependency-free, native ES-module application designed for GitHub Pages.

Username/password Account creation and login are the primary Identity experience. Profile setup is optional after registration and remains available from the Account menu. The mobile OTP flow is retained only as a prototype compatibility option.

## Local preview

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/mygita/`. Fixture repositories remain the default and require no server.

To exercise the API-backed implementation, start the mock API in a second terminal:

```sh
python3 mygita-server/dev_server.py
```

Then open `http://127.0.0.1:8000/mygita/?provider=api`. Omitting the query parameter returns to fixtures.

## Verification

Install repository development tools from the repository root:

```sh
cd dev-tools
pnpm install --frozen-lockfile
pnpm run check
```

The check runs checked-JavaScript analysis, generated-validator freshness, fixture/API repository contracts, architecture and fixture tests, OpenAPI verification, mock-response compatibility, the Gita Sāra API flow, and the password Account lifecycle flow. Development dependencies are isolated under `dev-tools/node_modules` and are not required by the browser application.

## Boundaries

- `src/core`: domain-agnostic foundations, including atomic UI and reusable composite components.
- `src/contracts`: generated OpenAPI runtime validators and the MyGita HTTP-contract adapter.
- `src/features`: Identity, Experience, and Journey domain modules, exposed through public entry points.
- `src/pages`: route-level screens that compose one or more features.
- `src/shell`: MyGita application chrome and navigation.
- `styles`: global tokens, base rules, layout and shared components.

Fixture and API providers implement the same feature repository contracts. API responses are validated against generated OpenAPI validators before provider-specific normalization returns domain data. See [ADR-0008](../docs/gitajyoti/decisions/ADR-0008-mygita-feature-and-page-composition.md).
