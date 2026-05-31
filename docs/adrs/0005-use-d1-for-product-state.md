# ADR 0005: Use Cloudflare D1 For Product State

## Status

Accepted

## Context

Live rank scans create spend and trust risk. The product needs account sessions, per-workspace credits, scan history, cache records, usage events, and rate-limit records before it can be shown as a paid self-serve workflow.

## Decision

Use Cloudflare D1 as the first persistence layer. Store users, organizations, memberships, subscriptions, sessions, scans, scan cache, geocode cache, usage events, and rate events in one D1 database bound to Pages Functions as `DB`.

## Consequences

- The product can protect live scans behind auth, credits, cache, and rate limits.
- Scan history and admin metrics can be served without adding a separate backend service.
- The schema is simple and easy to inspect during early customer trials.
- Higher scale may require migrations, indexes tuned from production usage, queues for scheduled scans, and a fuller billing system.
