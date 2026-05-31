# ADR 0005: Defer Persistence Until Live Provider QA Is Proven

## Status

Accepted

## Context

The project is currently a demo-ready product prototype. The most important unknown is whether live provider results match the expected local Maps ranking behavior across real businesses and markets.

## Decision

Keep the first implementation stateless. Reports render in the browser and can be exported, but scans are not saved to a database yet.

## Consequences

- The repository stays easy to run, review, and deploy.
- There is no stored personal or client data in the current system.
- Product demos can focus on workflow and architecture rather than account management.
- Before paid recurring use, the app needs persistence, caching, scan history, auth, billing, and rate controls.
