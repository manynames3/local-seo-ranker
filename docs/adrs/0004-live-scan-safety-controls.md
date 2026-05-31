# ADR 0004: Require Explicit Live-Scan Safety Controls

## Status

Accepted

## Context

Geo-grid rank checks can multiply provider usage quickly because each grid cell maps to a provider request. A 9x9 grid uses 81 requests, and larger grids can create surprise cost if a public endpoint is left open.

## Decision

Require `ENABLE_LIVE_SCANS=true` before live provider calls can run, even when `SCRAPPA_API_KEY` exists. Cap live scans with `MAX_LIVE_GRID_POINTS`, which defaults to 81.

## Consequences

- Adding a provider key alone does not open the meter.
- 7x7 and 9x9 scans are supported by default while 11x11 requires an intentional configuration change.
- The frontend and API return explicit fallback reasons when scans are disabled or too large.
- Production self-serve use still needs auth, rate limits, usage credits, and duplicate-scan caching.
