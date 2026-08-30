# My Gita mock API

Local, dependency-free Python API used while developing the My Gita browser client. It is not a production authentication or data service.

## Run

From the repository root:

```bash
python3 mygita-server/dev_server.py
```

The API starts at `http://127.0.0.1:8081/api/v1`. The prototype OTP is always `123456`.

Optional configuration:

```bash
MYGITA_DEV_JWT_SECRET='local-secret' \
MYGITA_DEV_ALLOWED_ORIGINS='http://127.0.0.1:8000,http://localhost:8000' \
python3 mygita-server/dev_server.py --port 8081
```

The default host is loopback-only. Do not expose this server to the internet.

## Test

```bash
python3 -m unittest discover -s mygita-server/tests -v
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

## Route summary

Public:

- `GET /api/v1/health`
- `GET /api/v1/experiences`
- `GET /api/v1/experiences/{slug}`
- `GET /api/v1/experiences/{slug}/batches`
- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`

Authenticated:

- `GET /api/v1/me`
- `PATCH /api/v1/me`
- `PATCH /api/v1/me/onboarding`
- `GET /api/v1/me/journey`
- `POST /api/v1/me/journey`
- `POST /api/v1/me/interests`
- `GET /api/v1/me/activities/{id}`
- `POST /api/v1/me/activities/{id}/complete`

Development:

- `POST /api/v1/dev/reset`

## Data

Editable catalogue data lives in `mock-data/`. Test registrations, profiles, enrolments and progress are written atomically to `runtime-data/state.json`. Runtime state is ignored by Git.

The mock JWT uses HMAC-SHA256, expires after eight hours and is accepted only by this local server. A production API must replace it with a trusted identity-provider flow.
