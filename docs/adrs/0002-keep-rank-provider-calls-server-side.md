# ADR 0002: Keep Rank Provider Calls Server-Side

## Status

Accepted

## Context

Live rank checks require a third-party provider API key and may create provider cost per grid point. Calling Scrappa directly from the browser would expose secrets and make cost control harder.

## Decision

Route live rank checks through `/api/scans` in Cloudflare Pages Functions. The browser sends scan inputs to the backend, and the backend owns provider authentication, validation, and response normalization.

## Consequences

- API keys are not exposed to client-side JavaScript.
- The backend can enforce live-scan flags, grid caps, CORS policy, and future rate limits.
- The frontend can use one API contract instead of provider-specific response shapes.
- Live scans require Cloudflare environment configuration before they can run.
