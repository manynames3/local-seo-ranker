# Local SEO Ranker

Standalone static Local SEO Competitive Intelligence tool.

## What It Does

- Accepts a business website, business name, target city/state, main service keyword, up to three competitors, optional Maps/GBP URL, and notes.
- Generates a deterministic Local SEO Authority Gap Report.
- Shows an estimated local ranking map view with a 14 x 14 rank grid, market pulse, scorecards, competitor comparison, topic gaps, entity signals, internal linking recommendations, AI search readiness, and a priority roadmap.
- Exports report copy, JSON, CSV, and print output.

Current scoring is intentionally labeled as estimated / placeholder until live crawl, GBP, SERP, GSC, citation, review, and third-party SEO data sources are connected.

## Run Locally

This is a static app with no build step:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Cloudflare Pages

- Build command: none
- Output directory: `.`
- Production branch: `main`

## Future Integrations

- Live local rank checks with Scrappa as the first provider. See [rank provider use cases](docs/rank-provider-use-cases.md).
- Google Search Console API
- Google Business Profile API
- PageSpeed Insights API
- Firecrawl, Crawl4AI, or site crawler
- Ahrefs, Semrush, or DataForSEO for deeper SEO enrichment
- Places API
- Review and citation data source
