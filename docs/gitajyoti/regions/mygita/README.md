# MyGita region

MyGita is the learner-facing orchestration region of the Gita Jyoti site. It provides a consistent home for identity, discovery, enrolment, journey navigation, product launch, and aggregated progress.

MyGita is not the learning implementation for every product. Specialized products own their curricula and learning interactions.

The public root `mygita.html` is the illustrated overview and Profile-registration doorway. The `mygita/` application remains the authenticated orchestration client. The public registration flow currently uses the API client's mock provider; live persistence is activated only after production `POST /v1/profiles` is accepted.

- [Current state](current-state.md)
- [Roadmap](roadmap.md)
- [Data-use optimization checklist](data-use-optimization.md)
- [Screen map](screen-map.md)
- [Integrations](integrations/README.md)
