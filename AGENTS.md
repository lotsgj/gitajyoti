# Repository guidance

Before changing Gita Jyoti, read `docs/gitajyoti/README.md`, `docs/gitajyoti/current-state.md`, the relevant region or product documentation, and accepted decisions under `docs/gitajyoti/decisions/`.

Use these terms consistently:

- **Site:** Gita Jyoti as a whole.
- **Region:** a major area within the site, currently Landing or MyGita.
- **Product:** an independently evolving learning application such as Gita for Children or Gita Sāra.
- **Experience:** an enrolable learning offering presented through MyGita.

When completing a milestone, update the current-state document and implementation checklist in the same commit. Add or supersede an ADR when an architectural decision changes. Do not make a product an internal MyGita component: MyGita integrates with products through explicit contracts.
