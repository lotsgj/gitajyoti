# MyGita API contract

[`openapi.yaml`](openapi.yaml) is the authoritative OpenAPI 3.1 contract between the MyGita browser client and `mygita.api`.

It describes every operation implemented by the local Flask API, including catalogue, authentication, Profile, onboarding, interests, enrolment, Journey, activities, progress, errors, and the development-only reset operation. Version 0.3 implements catalogue manifests, card summaries, conditional Experience details, and the private manifest; version 0.4 adds independent Journey, interest, and activity-state projections.

From `dev-tools/`, run:

```sh
pnpm run check:openapi
```

The check:

1. lints the OpenAPI document;
2. validates every documented request and response example; and
3. exercises every currently implemented API operation and validates the captured payloads against the corresponding response schema.

The client generates dependency-free runtime validators from this contract. Identity, Experience, and Journey API providers validate and normalize server responses before returning their repository-domain models. Version-aware repositories progressively cache public Experience data and Account-scoped private projections.
