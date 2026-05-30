# Local SEO Ranker

Standalone static Local SEO Competitive Intelligence tool.

## What It Does

- Accepts a business website, business name, target city/state, main service keyword, up to three competitors, optional Maps/GBP URL, and notes.
- Generates a deterministic Local SEO Authority Gap Report.
- Shows an estimated territory rank grid, market pulse, scorecards, competitor comparison, topic gaps, entity signals, internal linking recommendations, AI search readiness, and a priority roadmap.
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

- Google Search Console API
- Google Business Profile API
- SERP API
- PageSpeed Insights API
- Firecrawl, Crawl4AI, or site crawler
- Ahrefs, Semrush, or DataForSEO
- Places API
- Review and citation data source
