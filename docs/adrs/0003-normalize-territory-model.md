# ADR 0003: Normalize Live And Estimated Reports Into One Territory Model

## Status

Accepted

## Context

The UI needs to render the same local ranking map, scorecards, exports, and report sections whether the report comes from deterministic demo estimates or live provider results.

## Decision

Normalize rank data into a shared `territory` object with cells, rank summaries, grid metadata, provider status, and generated timestamps. Live Scrappa results and fallback estimates both feed this shape.

## Consequences

- The frontend rendering path stays simple.
- Provider adapters can be added without rewriting the report UI.
- Tests can focus on the shared contract.
- The model must clearly label data status so estimated cells are not confused with live Maps rank evidence.
