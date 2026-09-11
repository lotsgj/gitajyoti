# ADR-0004: UI-to-repository boundary

- Status: Accepted
- Implementation: Implemented
- Supersedes: None
- Superseded by: None
- Date: 2026-09-10

## Decision

MyGita UI modules will access domain data and operations only through feature repositories. Fixture and API providers will implement the same asynchronous repository interfaces. UI modules will not depend directly on fixture services or HTTP transport.
