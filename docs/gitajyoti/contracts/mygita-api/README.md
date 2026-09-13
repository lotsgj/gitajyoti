# mygita.api

Filesystem ID: `mygita-api`

This contract describes communication between the MyGita client and MyGita server: catalogue, authentication, profile, onboarding, enrolment, interests, journeys, activities, launch, and aggregated progress.

The authoritative OpenAPI document is [`contracts/mygita-api/openapi.yaml`](../../../../contracts/mygita-api/openapi.yaml). Version 0.3 implements public catalogue versions, summaries, conditional Experience details, and the private manifest. Version 0.4 adds independently cacheable Journey, interest, and activity-state projections. Password Account creation and login remain implemented and verified.
