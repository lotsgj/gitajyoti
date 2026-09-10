# MyGita API contract

[`openapi.yaml`](openapi.yaml) is the authoritative OpenAPI 3.1 contract between the MyGita browser client and `mygita.api`.

It currently describes every operation implemented by the local Python mock API, including catalogue, OTP authentication, learner profile and onboarding, interests, enrolment, journey, activities, progress, errors, and the development-only reset operation.

From `dev-tools/`, run:

```sh
pnpm run check:openapi
```

The check:

1. lints the OpenAPI document;
2. validates every documented request and response example; and
3. exercises every mock API operation and validates the captured payloads against the corresponding response schema.

The contract does not connect the browser to the server. API adapters, runtime validation at the client boundary, API-backed repositories, and provider selection remain the next implementation phase.
