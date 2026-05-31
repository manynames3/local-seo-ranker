# ADR 0001: Use Cloudflare Pages With Pages Functions

## Status

Accepted

## Context

The product needs a fast static frontend, a small backend boundary for rank-provider calls, and a low-friction deployment path. The app does not need a persistent server process, database connection pool, or long-running compute instance.

## Decision

Host the frontend on Cloudflare Pages and implement backend scan behavior with Cloudflare Pages Functions under `functions/`.

## Consequences

- Static assets and backend routes deploy from the same repository.
- The frontend remains simple and fast to review.
- Provider secrets can stay server-side in Cloudflare environment variables.
- D1, queues, and any future auth providers can be added as Cloudflare bindings without moving the core runtime.
