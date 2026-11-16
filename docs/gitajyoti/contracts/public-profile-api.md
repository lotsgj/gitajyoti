# Public Profile API

`register.html` uses a separately deployed public Profile and invitation API. This is distinct from the repository-local `mygita.api` contract: it creates a public Profile, but does not create an Account, authentication session, enrolment, Journey, or product access.

## Contract authority

- Contract version: **1.1.0**.
- Client library: `https://dev.api.gitajyoti.org/v1/client.js` during development; `https://api.gitajyoti.org/v1/client.js` once production reaches contract 1.1.
- The API-server repository documentation and published client are the authoritative implementation source. This website consumes them; it does not duplicate their schema or validation rules.

## Browser boundary

Only [`assets/js/registration-repository.js`](../../../assets/js/registration-repository.js) imports the published client. Page code uses its `validateProfile`, `getInvitation`, and `createProfile` methods.

The six Profile fields are `name`, `mobile`, `email`, `gender`, `date_of_birth`, and `preferred_language`. An invitation is supplied separately as optional `invitation_code`. The UI must not send page-only values such as an invitation display object, a marketing preference, or an intended destination.

## Operations used by the website

- `GET /v1/invitations/{code}` returns an active invitation with its Experience and Offering context.
- `POST /v1/profiles` creates a Profile, or adds a valid new invitation to a matching Profile and returns `created: false`.

The client returns result objects rather than throwing API failures. The repository turns unsuccessful results into normalized browser errors so page code remains independent of transport details.

## Deployment state

Local builds default to `data-registration-mode="mock"` and call `createMockApi()` from the development 1.1 client. This preserves the full registration and invitation interaction without writing durable data. The public Pages workflow defaults to live mode because production serves contract 1.1; it uses `connect()` and switches both the API base URL and client-library URL to production. Set the repository variable `REGISTRATION_DEPLOY_MODE=mock` for an explicit emergency rollback.
