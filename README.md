# Local SEO Ranker

Standalone Local SEO Competitive Intelligence tool for agencies and consultants.

## What It Does

- Accepts a business website, business name, target city/state, main service keyword, center coordinates, grid size, up to three competitors, optional Maps/GBP URL, and notes.
- Generates a deterministic Local SEO Authority Gap Report in demo mode.
- Includes a Cloudflare `/api/scans` route for live Scrappa Maps rank checks when backend secrets and center coordinates are configured.
- Shows a local ranking map view, market pulse, scorecards, competitor comparison, topic gaps, entity signals, internal linking recommendations, AI search readiness, and a priority roadmap.
- Exports report copy, JSON, CSV, and print output.

Current scoring is intentionally labeled as estimated and directional until live crawl, GBP, SERP, GSC, citation, review, and third-party SEO data sources are connected.

## Current Product State

This repository is demo-ready and live-scan-ready. The browser never calls Scrappa directly. Live rank checks are only attempted through the Cloudflare backend route at `/api/scans`.

If `/api/scans` is unavailable, `SCRAPPA_API_KEY` is missing, or center coordinates are missing, the app clearly falls back to the estimated report and labels the output as an estimate. Do not present estimated rank cells as live Google Maps data.

## Run Locally

Static demo only:

```bash
npm run serve
```

Open `http://localhost:4173`.

Cloudflare Pages Functions with `/api/scans`:

```bash
npx wrangler pages dev .
```

Open the Wrangler local URL and use Live Scrappa mode.

## Cloudflare Pages

- Build command: none
- Output directory: `.`
- Production branch: `main`

## Environment Variables

The static demo requires no environment variables.

Live rank checks require `SCRAPPA_API_KEY` on the Cloudflare backend. Use `.env.example` as the starting point and store real secrets in Cloudflare, not in the browser or committed files.

```bash
wrangler pages secret put SCRAPPA_API_KEY --project-name local-seo-ranker
```

## API Contract

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

Live mode returns a normalized `territory` object that the frontend can render directly. If live mode cannot run, the API returns an explicit reason such as `missing_scrappa_key` or `missing_center_coordinates`.

## Quality Checks

```bash
npm run check
```

## Future Integrations

- Live local rank checks with Scrappa as the first provider. See [rank provider use cases](docs/rank-provider-use-cases.md).
- Google Search Console API
- Google Business Profile API
- PageSpeed Insights API
- Firecrawl, Crawl4AI, or site crawler
- Ahrefs, Semrush, or DataForSEO for deeper SEO enrichment
- Places API
- Review and citation data source
