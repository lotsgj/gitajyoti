# Repository boundaries

```text
UI → feature repository → fixture provider
                        └→ API provider → API adapter → mygita.api
```

UI code works only through feature repositories. It does not import fixtures, construct URLs, inspect HTTP status codes, or manage access tokens.

UI-to-repository contracts receive design-time checking. Runtime validation is not duplicated at this trusted internal boundary. API responses are runtime-validated in API adapters before repositories expose normalized domain data.

Initial repositories are Experience, Authentication, Journey, and Activity. Profile operations remain with Authentication until profile capabilities justify an independent boundary.
