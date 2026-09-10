# Repository boundaries

```text
UI → feature repository → fixture provider
                        └→ API provider → API adapter → mygita.api
```

UI code works only through feature repositories. It does not import fixtures, construct URLs, inspect HTTP status codes, or manage access tokens.

UI-to-repository contracts receive design-time checking. Runtime validation is not duplicated at this trusted internal boundary. API responses are runtime-validated in API adapters before repositories expose normalized domain data.

Initial repositories align with the three domain features: Identity, Experience, and Journey.

- Identity owns authentication, session, learner identity, profile, roles, and identity-level authorization information.
- Experience owns the catalogue, experience details, batches, availability, and product association.
- Journey owns enrolment, participation, learner activity state, progress, completion, and product launch state.

Reusable activity definitions belong to Experience or the associated product; learner-specific activity state belongs to Journey. Resource-specific authorization remains with the feature that owns the resource.

Route-level pages live outside the feature directories and may compose several features only through their public entry points. Pages never import fixture providers, API providers, transport details, or private feature modules. See [ADR-0008](../decisions/ADR-0008-mygita-feature-and-page-composition.md).
