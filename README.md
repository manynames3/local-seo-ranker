# Local SEO Ranker

Local SEO Ranker is a standalone local SEO visibility application for agencies, consultants, and local-business operators. It turns a business, target keyword, market, competitors, and optional Maps center coordinates into a territory rank grid, authority gap report, saved scan history, and prioritized execution roadmap. Strategy reports run instantly in the browser; live Maps scans run through protected Cloudflare Pages Functions with account sessions, credits, caching, rate limits, and server-side provider credentials.

Live app: [local-seo-ranker.pages.dev](https://local-seo-ranker.pages.dev)

## About

Local SEO Ranker is built around the workflow a local SEO seller or operator needs in a prospect or client call: show where a business is weak across a market, explain why competitors are winning, and export the build plan. It is niche-flexible, so the same flow can be used for plumbers, electricians, photographers, restaurants, clinics, home services, and other local intent keywords.

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript, client-side report rendering, JSON/CSV/text/print exports.
- Runtime: Cloudflare Pages static assets plus Cloudflare Pages Functions; AWS path with S3, CloudFront, API Gateway, Lambda, and DynamoDB.
- Data: Cloudflare D1 for the Cloudflare deployment; DynamoDB single-table storage for the AWS deployment.
- Provider integration: Scrappa Google Maps Advanced Search through server-side API calls.
- Testing: Node.js built-in `node:test`, syntax checks with `node --check`.
- Deployment: GitHub repository connected to Cloudflare Pages, production branch `main`, output directory `.`.

## What It Does

- Accepts a business website, business name, target city/state, main keyword, optional Maps URL, center coordinates, grid size, competitors, and notes.
- Generates a deterministic strategy report without consuming live scan credits.
- Runs protected live Maps rank checks when the user is signed in, credits are available, the live flag is enabled, and a provider key is configured.
- Locates a map center from business and market details through a protected geocode endpoint.
- Saves live scan history to the signed-in workspace.
- Shows a local ranking map view, market pulse, scorecards, competitor comparison, topic gaps, entity signals, internal linking recommendations, AI search readiness, and a priority roadmap.
- Exports report copy, JSON, CSV, and print output.

## Engineering Highlights

- Server-side provider boundary: Maps/SERP provider requests run only in Cloudflare Pages Functions, keeping API keys out of browser code.
- Account and credit model: D1 stores users, organizations, sessions, subscriptions, usage events, and per-workspace credit consumption.
- Protected scan API: live scans require an authenticated session, configured live-scan flag, valid coordinates, available credits, and rate-limit clearance.
- Cost guardrails: 9x9 scans consume 81 credits by default, duplicate scans can use cached live results, and oversized grids are blocked by `MAX_LIVE_GRID_POINTS`.
- Normalized territory model: live provider responses and strategy estimates both render through the same `territory` contract.
- Geo-grid generation: server utilities generate odd-sized coordinate grids from center latitude, longitude, grid size, and point spacing.
- Business matching logic: provider results are matched by Maps identifier, domain, and normalized business name scoring.
- Lightweight admin surface: admin accounts can view user, workspace, scan, and credit totals from the product UI.

## Architecture

- Architecture overview: [docs/architecture.md](docs/architecture.md)
- AWS deployment: [docs/aws-deployment.md](docs/aws-deployment.md)
- Architecture decisions: [docs/adrs/README.md](docs/adrs/README.md)
- Rank provider notes: [docs/rank-provider-use-cases.md](docs/rank-provider-use-cases.md)
- Sales walkthrough: [docs/sales-script.md](docs/sales-script.md)

## Current Product State

The application is suitable for controlled live-user trials. It has account sessions, credits, live scan protection, scan history, geocoding, provider caching, trust pages, and admin visibility. Billing, team management, custom domains, scheduled scans, and deeper provider QA are still pending before broad self-serve sales.

## Privacy And Security

- The browser does not call Scrappa directly.
- Provider secrets belong in Cloudflare environment variables, not committed files.
- Account sessions use HTTP-only secure cookies.
- API responses use `cache-control: no-store`.
- CORS is restricted to the request origin and optional `SCAN_ALLOWED_ORIGINS` values rather than a wildcard.
- Scan history is scoped to the signed-in workspace.
- Trust pages are available at `/privacy.html` and `/terms.html`.

## Limitations

- Live rank accuracy still needs provider QA against manual Google Maps checks across more real businesses and markets.
- Billing is not wired yet; credits are currently managed through the internal subscription records.
- There is no password-based login, social auth, team invitation flow, or user-facing plan upgrade screen yet.
- Scheduled recurring scans are not implemented yet.

## Run Locally

Static strategy reports:

```bash
npm run serve
```

Open `http://localhost:4173`.

Cloudflare Pages Functions:

```bash
npm run dev
```

Open the Wrangler local URL. Local live-scan testing requires the same bindings and secrets used in Cloudflare.

## Cloudflare Pages

- Build command: none
- Output directory: `.`
- Production branch: `main`
- Live URL: [https://local-seo-ranker.pages.dev](https://local-seo-ranker.pages.dev)
- D1 binding: `DB`

## Environment Variables And Bindings

Required for live scans:

- `SCRAPPA_API_KEY`
- `ENABLE_LIVE_SCANS=true`
- D1 database binding named `DB`

Optional controls:

- `MAX_LIVE_GRID_POINTS`, default `81`
- `SCAN_ALLOWED_ORIGINS`, comma-separated origin allowlist
- `DEFAULT_MONTHLY_CREDITS`, default `2500`
- `APP_ACCESS_CODE`, invite code for new accounts
- `ALLOW_OPEN_SIGNUPS`, default `false`
- `ADMIN_EMAILS`, comma-separated admin allowlist

Example:

```bash
wrangler pages secret put SCRAPPA_API_KEY --project-name local-seo-ranker
```

The first account can be bootstrapped without an invite code when no users exist and `APP_ACCESS_CODE` is unset. After that, new accounts require the configured invite code unless open signups are explicitly enabled.

## API Contract

`POST /api/auth/login`

Creates or resumes an account session with email, optional name, and invite code. Returns account and credit state.

`GET /api/auth/me`

Returns the current signed-in account, workspace, admin flag, and credits.

`POST /api/geocode`

Requires auth. Uses one credit to locate a map center for a business and market, with a 30-day workspace cache.

`POST /api/scans`

Requires auth for live scans. Required fields:

- `businessName`
- `websiteUrl`
- `keyword`
- `city`
- `state`
- `scanMode`
- `gridSize`
- `centerLat`
- `centerLon`

Live mode returns a normalized `territory` object that the frontend can render directly. Common refusal reasons include `auth_required`, `insufficient_credits`, `rate_limited`, `live_scans_disabled`, `grid_too_large`, `missing_scrappa_key`, and `missing_center_coordinates`.

`GET /api/history`

Requires auth. Returns recent saved scans for the current workspace.

`GET /api/admin/overview`

Requires admin. Returns account, workspace, scan, subscription, and usage totals.

## Quality Checks

```bash
npm run check
git diff --check
```

## Repository Structure

```text
.
|-- index.html
|-- privacy.html
|-- terms.html
|-- styles.css
|-- app.js
|-- functions/
|   |-- api/
|   |   |-- auth/
|   |   |-- admin/
|   |   |-- geocode.js
|   |   |-- history.js
|   |   `-- scans.js
|   `-- _lib/
|       |-- auth.js
|       |-- db.js
|       |-- http.js
|       `-- scan-utils.js
|-- aws/
|   `-- lambda/
|-- infra/
|   `-- aws/
|-- .github/
|   `-- workflows/
|-- tests/scan-utils.test.js
|-- docs/
|   |-- architecture.md
|   |-- aws-deployment.md
|   |-- adrs/
|   |-- sales-script.md
|   `-- rank-provider-use-cases.md
|-- _headers
|-- _redirects
|-- package.json
`-- favicon.svg
```

## Next Integrations

- Stripe subscriptions and plan-based credit allocation.
- Team invitations, workspace roles, and passwordless email login.
- Scheduled recurring scans and trend charts.
- Manual rank QA workflow for live provider verification.
- SerpBase fallback adapter after Scrappa QA.
- DataForSEO adapter for larger recurring rank-tracking workflows.
