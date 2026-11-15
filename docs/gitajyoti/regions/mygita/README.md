# MyGita region

MyGita is the learner-facing orchestration region of the Gita Jyoti site. It provides a consistent home for identity, discovery, enrolment, journey navigation, product launch, and aggregated progress.

MyGita is not the learning implementation for every product. Specialized products own their curricula and learning interactions.

The public root `mygita.html` is the illustrated overview and Profile-registration doorway. The `mygita/` application remains the authenticated orchestration client. The root-served registration flow currently writes to the development Profile API; switching the deployed artifact to production remains gated on acceptance of production `POST /v1/profiles`.

- [Current state](current-state.md)
- [Roadmap](roadmap.md)
- [Data-use optimization checklist](data-use-optimization.md)
- [Screen map](screen-map.md)
- [Integrations](integrations/README.md)
