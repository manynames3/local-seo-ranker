# ADR 0001: Use Cloudflare Pages With Pages Functions

## Status

Accepted

## Context

The product needs a public static demo, a small backend boundary for rank-provider calls, and a low-friction deployment path. The current app does not need a persistent server, database connection pool, or long-running workers.

## Decision

Host the frontend on Cloudflare Pages and implement backend scan behavior with Cloudflare Pages Functions under `functions/`.

## Consequences

- Static assets and backend routes deploy from the same repository.
- The frontend remains simple and fast to review.
- Provider secrets can stay server-side in Cloudflare environment variables.
- Future persistence, queues, and auth will need additional platform services or a separate backend layer.
