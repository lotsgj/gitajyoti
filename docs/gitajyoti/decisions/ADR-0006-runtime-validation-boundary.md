# ADR-0006: Runtime validation boundary

Status: Accepted  
Date: 2026-09-10

## Decision

Runtime schema validation occurs where API responses enter client API adapters. The trusted UI-to-repository boundary uses design-time checking and does not duplicate runtime validation.
