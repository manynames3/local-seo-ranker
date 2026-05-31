# ADR 0003: Normalize Live And Strategy Reports Into One Territory Model

## Status

Accepted

## Context

The UI needs to render the same local ranking map, scorecards, exports, and report sections whether the report comes from a deterministic strategy model or live provider results.

## Decision

Normalize rank data into a shared `territory` object with cells, rank summaries, grid metadata, provider status, and generated timestamps. Live Maps results and strategy-mode estimates both feed this shape.

## Consequences

- The frontend rendering path stays simple.
- Provider adapters can be added without rewriting the report UI.
- Tests can focus on the shared contract.
- The model must clearly label data status so strategy-mode cells are not confused with live Maps rank evidence.
