# Local SEO Ranker

Local SEO Ranker is a standalone territory visibility tool for local SEO agencies and consultants. It turns a business, target keyword, city, competitors, and optional Google Maps coordinates into a local ranking grid, authority gap report, and prioritized execution roadmap. The current product supports a transparent deterministic demo mode and includes a Cloudflare Pages Function path for live Scrappa Maps rank checks when backend secrets and live-scan controls are configured.

Live demo: [local-seo-ranker.pages.dev](https://local-seo-ranker.pages.dev)

## About

This project explores how a local SEO product can move beyond generic audits into territory-level rank evidence. The interface is designed around the workflow an agency would use in a prospect or client call: show where the business is weak across a market, explain the likely authority gaps, and export a build plan.

The app is intentionally honest about data state. Demo reports are labeled as estimated. Live rank checks are routed through the backend only, and the browser never receives provider API keys.

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript, accessible form controls, client-side report rendering, JSON/CSV/text/print exports.
- Runtime: static Cloudflare Pages site with Cloudflare Pages Functions for `/api/scans`.
- Provider integration: Scrappa Google Maps Advanced Search via server-side API key.
- Testing: Node.js built-in `node:test`, syntax checks with `node --check`.
- Deployment: GitHub repository connected to Cloudflare Pages, production branch `main`, output directory `.`.

## What It Does

- Accepts a business website, business name, target city/state, main service keyword, center coordinates, grid size, up to three competitors, optional Maps/GBP URL, and notes.
- Generates a deterministic Local SEO Authority Gap Report in demo mode.
- Supports a backend `/api/scans` route for live Scrappa Maps rank checks when `SCRAPPA_API_KEY`, `ENABLE_LIVE_SCANS=true`, center coordinates, and scan caps are configured.
- Shows a local ranking map view, market pulse, scorecards, competitor comparison, topic gaps, entity signals, internal linking recommendations, AI search readiness, and a priority roadmap.
- Exports report copy, JSON, CSV, and print output.

## Engineering Highlights

- Server-side provider boundary: Scrappa requests run only in Cloudflare Pages Functions, keeping API keys out of browser code.
- Normalized rank model: live provider responses and fallback estimates both render through the same `territory` contract.
- Geo-grid generation: server utilities generate odd-sized coordinate grids from center latitude, longitude, grid size, and point spacing.
- Business matching logic: provider results are matched by Maps identifier, domain, and normalized business name scoring.
- Cost guardrails: live scans require an explicit `ENABLE_LIVE_SCANS=true` flag and default to `MAX_LIVE_GRID_POINTS=81`.
- Clear fallback states: missing provider key, disabled live scans, missing coordinates, oversized grids, and unavailable APIs all return explicit user-facing reasons.
- Lightweight test coverage: core scan utilities and backend safety behavior are covered with Node's built-in test runner.

## Architecture

- Architecture overview: [docs/architecture.md](docs/architecture.md)
- Architecture decisions: [docs/adrs/README.md](docs/adrs/README.md)
- Rank provider notes: [docs/rank-provider-use-cases.md](docs/rank-provider-use-cases.md)
- Demo script: [docs/demo-script.md](docs/demo-script.md)

## Current Product State

This repository is demo-ready and live-scan-ready. Current scoring is intentionally labeled as estimated and directional unless the report is generated from live Scrappa evidence.

If `/api/scans` is unavailable, live scans are disabled, `SCRAPPA_API_KEY` is missing, the grid is above the backend cap, or center coordinates are missing, the app falls back to the estimated report and labels the output as an estimate. Do not present estimated rank cells as live Google Maps data.

## Privacy And Security

- The browser does not call Scrappa directly.
- Provider secrets belong in Cloudflare environment variables, not committed files.
- API responses use `cache-control: no-store`.
- CORS is restricted to the request origin and optional `SCAN_ALLOWED_ORIGINS` values rather than a wildcard.
- There is no user account system or persisted scan database yet, so demo reports live in the browser session unless exported.

## Limitations

- Live scans require manual center latitude and longitude until geocoding is added.
- The current app does not include accounts, billing, saved reports, scheduled scans, or scan history.
- Demo mode is deterministic and directional; it is not a live Google Maps rank tracker.
- Live rank accuracy still needs provider QA against manual Google Maps checks before selling recurring tracking.
- Duplicate live-scan caching is not implemented yet, so production use should add persistence and rate controls.

## Run Locally

Static demo only:

```bash
npm run serve
```

Open `http://localhost:4173`.

Cloudflare Pages Functions with `/api/scans`:

```bash
npm run dev
```

Open the Wrangler local URL and use Live Scrappa mode.

## Cloudflare Pages

- Build command: none
- Output directory: `.`
- Production branch: `main`
- Live URL: [https://local-seo-ranker.pages.dev](https://local-seo-ranker.pages.dev)

## Environment Variables

The static demo requires no environment variables.

Live rank checks require `SCRAPPA_API_KEY` and `ENABLE_LIVE_SCANS=true` on the Cloudflare backend. Use `.env.example` as the starting point and store real secrets in Cloudflare, not in the browser or committed files.

```bash
wrangler pages secret put SCRAPPA_API_KEY --project-name local-seo-ranker
wrangler pages secret put ENABLE_LIVE_SCANS --project-name local-seo-ranker
wrangler pages secret put MAX_LIVE_GRID_POINTS --project-name local-seo-ranker
wrangler pages secret put SCAN_ALLOWED_ORIGINS --project-name local-seo-ranker
```

Default live-scan safety:

- `ENABLE_LIVE_SCANS` must be exactly `true`; adding a Scrappa key alone will not open the meter.
- `MAX_LIVE_GRID_POINTS` defaults to `81`, which allows 7x7 and 9x9 live scans but blocks 11x11 unless raised.
- `SCAN_ALLOWED_ORIGINS` can include comma-separated origins for previews or a custom domain.

## API Contract

`GET /api/scans`

Returns provider readiness metadata, including whether live scans are enabled and the current max grid point cap.

`POST /api/scans`

Required fields:

- `businessName`
- `websiteUrl`
- `keyword`
- `city`
- `state`
- `scanMode`
- `gridSize`
- `centerLat`
- `centerLon`

Live mode returns a normalized `territory` object that the frontend can render directly. If live mode cannot run, the API returns an explicit reason such as `live_scans_disabled`, `grid_too_large`, `missing_scrappa_key`, or `missing_center_coordinates`.

## Quality Checks

```bash
npm run check
```

This runs JavaScript syntax checks and the Node test suite.

## Project Structure

```text
.
|-- index.html
|-- styles.css
|-- app.js
|-- functions/
|   |-- api/scans.js
|   `-- _lib/scan-utils.js
|-- tests/scan-utils.test.js
|-- docs/
|   |-- architecture.md
|   |-- adrs/
|   |-- demo-script.md
|   `-- rank-provider-use-cases.md
|-- _headers
|-- _redirects
|-- package.json
`-- favicon.svg
```

## Future Integrations

- Scan persistence and duplicate-request caching.
- Address or city geocoding for center coordinates.
- Auth, billing, usage credits, and per-user rate limits.
- Google Search Console API.
- Google Business Profile API.
- PageSpeed Insights API.
- Firecrawl, Crawl4AI, or site crawler.
- SerpBase fallback adapter after Scrappa QA.
- DataForSEO for larger recurring rank-tracking workflows.
