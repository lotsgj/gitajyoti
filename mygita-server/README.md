# My Gita mock API

Local Python API used while developing the My Gita browser client, built on Flask. It is not an approved production identity, application-server, or database deployment.

## Setup

From the repository root:

```bash
cd mygita-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python3 mygita-server/dev_server.py
```

The API starts at `http://127.0.0.1:8081/api/v1`. The prototype OTP is always `123456`. Runs against `JsonStore` by default; add `--store sqlite` to run against `SqliteStore` (`runtime-data/state.db`) instead.

Optional configuration:

```bash
MYGITA_DEV_JWT_SECRET='local-secret' \
MYGITA_DEV_ALLOWED_ORIGINS='http://127.0.0.1:8000,http://localhost:8000' \
python3 mygita-server/dev_server.py --port 8081 --store sqlite
```

If `MYGITA_DEV_JWT_SECRET` is unset, a random secret is generated for that process — convenient for local dev (nothing predictable ships in source control), but sessions will not survive a restart.

The default host is loopback-only. Do not expose this server to the internet.

### Running under a real WSGI server

`wsgi.py` is the production-style entry point (e.g. for PythonAnywhere's manual Flask configuration) — it exposes an `application` WSGI callable, configured entirely from environment variables since a WSGI file takes no CLI arguments: `MYGITA_JWT_SECRET` (required — no random fallback, since a real WSGI server commonly runs multiple worker processes that would otherwise each mint a mutually-incompatible secret), `MYGITA_ALLOWED_ORIGINS`, `MYGITA_STORE_BACKEND` (`json` or `sqlite`).

## Test

```bash
python3 -m unittest discover -s mygita-server/tests -v
```

Runs the full behavior suite against both `JsonStore` and `SqliteStore`.

The authoritative HTTP contract is [`contracts/mygita-api/openapi.yaml`](../contracts/mygita-api/openapi.yaml). After installing the versioned development tools, lint it, validate its examples, and check mock responses with:

```bash
cd dev-tools
pnpm run check:openapi
```

## Authentication flow

Request an OTP challenge:

```bash
curl -s http://127.0.0.1:8081/api/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"countryCode":"+91","mobile":"9876543210"}'
```

Verify the returned `challengeId` using OTP `123456`:

```bash
curl -s http://127.0.0.1:8081/api/v1/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"challengeId":"<challenge-id>","otp":"123456"}'
```

Use the returned token on protected routes:

```bash
curl -s http://127.0.0.1:8081/api/v1/me \
  -H 'Authorization: Bearer <access-token>'
```

Username/password Accounts are the other primary path — see `POST /api/v1/auth/accounts` and `POST /api/v1/auth/password/login` below.

## Route summary

Public:

- `GET /api/v1`
- `GET /api/v1/health`
- `GET /api/v1/experiences`
- `GET /api/v1/experience-catalogue/manifest`
- `GET /api/v1/experience-catalogue/summaries`
- `GET /api/v1/experiences/{slug}`
- `GET /api/v1/experiences/{slug}/batches`
- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/accounts`
- `POST /api/v1/auth/password/login`

Authenticated:

- `GET /api/v1/me`
- `GET /api/v1/me/manifest`
- `PATCH /api/v1/me`
- `PATCH /api/v1/me/onboarding`
- `GET /api/v1/me/journey`
- `POST /api/v1/me/journey`
- `GET /api/v1/me/journeys`
- `GET /api/v1/me/interests`
- `POST /api/v1/me/interests`
- `GET /api/v1/me/activity-state`
- `GET /api/v1/me/activities/{id}`
- `POST /api/v1/me/activities/{id}/complete`

Development:

- `POST /api/v1/dev/reset`

## Data

Editable catalogue data lives in `mock-data/`. Runtime state (users, Accounts, Journeys, interests) is persisted under `runtime-data/`, ignored by Git — as `state.json` for `JsonStore` (the default), or `state.db`/`-wal`/`-shm` for `SqliteStore` (`--store sqlite`). See `contracts/roadmap.md` and `contracts/suggestions.md` for the persistence-boundary design and open items.

The mock JWT uses HMAC-SHA256, expires after eight hours and is accepted only by this local server. A production API must replace it with a trusted identity-provider flow.
