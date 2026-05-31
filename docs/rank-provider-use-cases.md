# Rank Provider Use Cases

Local SEO Ranker should use Scrappa as the first live rank-check provider. The product needs affordable, coordinate-based Google Maps/SERP checks before it needs a heavier enterprise SEO data stack.

Pricing and endpoint details can change, so verify provider docs before production launch or billing changes.

## Provider Decision

| Provider | Role in this product | Best use case | Ideal scenario |
| --- | --- | --- | --- |
| Scrappa | Primary MVP provider | Low-cost Google Maps and SERP checks for local ranking grids | On-demand 7 x 7, 9 x 9, or 11 x 11 geo-grid scans for agencies and first paying users |
| SerpBase | Backup and comparison provider | Low-cost SERP and Maps fallback when Scrappa needs validation or redundancy | A second adapter for cross-checking ranks, uptime fallback, and comparing Maps result consistency |
| DataForSEO | Pro/scale provider | Higher-confidence SEO data workflows with mature queue/live modes and broader SEO APIs | Recurring client rank tracking, scheduled scans, deeper SEO enrichment, and agency-grade reporting |

## Scrappa

Use Scrappa first.

Scrappa is the best fit for the current stage because it has Google Maps endpoints, Google Search endpoints, coordinate controls on Maps advanced search, simple API-key auth, and a low entry cost. Its Maps Advanced Search endpoint supports `query`, `zoom`, optional `lat` and `lon`, result limits, language, region, and selected fields.

Ideal scenarios:

- MVP geo-grid rank checks where each grid point runs one Maps search.
- Prospect audits where the user enters business, keyword, and city, then gets a sellable local ranking view.
- Low-volume agency workflows where cost control matters more than enterprise support.
- Testing 7 x 7, 9 x 9, and 11 x 11 grid sizes before committing to recurring rank tracking.
- Enriching reports with public Maps details, review data, photos, or business profile fields.

Use cases in Local SEO Ranker:

- Generate rank grid cells from a center coordinate and spacing.
- Search Google Maps at each grid coordinate for the target keyword.
- Match the target business by `business_id`, name, website, phone, and address.
- Store raw provider response plus normalized rank result for each grid point.
- Render rank, coverage, weak zones, and competitor visibility on the map view.

Watch-outs:

- Validate rank consistency against manual checks before selling it as exact.
- Keep `ENABLE_LIVE_SCANS=false` until the deployment has a Scrappa key, origin allowlist, and live-scan cost cap configured.
- Set daily spend limits and per-scan grid limits. The current backend defaults to `MAX_LIVE_GRID_POINTS=81`.
- Cache identical scans to avoid accidental duplicate billing.
- Keep Scrappa behind a backend route so API keys never reach the browser.

Docs:

- https://scrappa.co/docs/google-maps-api/advanced_search
- https://scrappa.co/docs/google-search-api/search
- https://scrappa.co/pricing

## SerpBase

Use SerpBase as the second adapter, not the first dependency.

SerpBase is attractive because it has a low-cost entry model and exposes Google Search plus Google Maps endpoints. Its docs list Search for organic/rich SERP modules and Maps Search for local place search with coordinates.

Ideal scenarios:

- Provider fallback if Scrappa is down, delayed, or produces questionable results.
- Accuracy comparison during early QA.
- Low-cost SERP enrichment where the app needs organic results in addition to Maps rankings.
- A/B testing provider latency and result shape before adding higher-volume customers.

Use cases in Local SEO Ranker:

- Re-run a subset of grid points to compare rank agreement with Scrappa.
- Fill gaps when a Scrappa request fails or rate limits.
- Pull organic SERP context for the same keyword and market.
- Confirm whether a business appears in Maps Search by coordinate before marking a point as not found.

Watch-outs:

- Maps Search is listed separately from regular Search and may have different credit cost.
- Confirm result depth, business identifiers, and coordinate behavior before relying on it as the main provider.
- Keep normalization strict so SerpBase responses produce the same internal `rankPoint` shape as Scrappa.

Docs:

- https://serpbase.dev/docs
- https://serpbase.dev/

## DataForSEO

Use DataForSEO when the tool graduates from MVP to serious recurring rank tracking.

DataForSEO is the stronger long-term provider for agencies or SaaS users who need reliability, queue processing, coordinate-level Maps SERPs, support, usage controls, and access to adjacent SEO APIs. It is not the cheapest starting point because it has a higher minimum payment, but it is a strong fit once users are paying for recurring reports.

Ideal scenarios:

- Scheduled weekly or monthly rank scans for retained clients.
- Larger scan volumes where queue mode and usage controls matter.
- Agency reporting that needs confidence, repeatability, support, and invoices.
- Product tiers that bundle Maps rank tracking with other SEO data sources.
- Future features that use DataForSEO Labs, OnPage, Reviews, AI visibility, or keyword data.

Use cases in Local SEO Ranker:

- Run high-volume queued Maps SERP tasks for many clients.
- Offer a "pro accuracy" provider mode on paid plans.
- Add organic SERP, reviews, keyword, backlink, on-page, or AI-search enrichment.
- Compare historical rank changes from stored scan results.

Watch-outs:

- Requires a larger upfront payment than Scrappa or SerpBase.
- Queue mode is cheaper but not instant, so the UI needs scan status and polling.
- Live mode is better for real-time UX but costs more.
- Additional parameters and depth can increase cost.

Docs:

- https://dataforseo.com/pricing/serp/google-maps-serp-api
- https://dataforseo.com/apis/serp-api/pricing
- https://docs.dataforseo.com/v3/serp-maps-live-advanced/

## Implementation Notes

Keep provider-specific code behind a single internal interface:

```ts
interface RankProvider {
  name: "scrappa" | "serpbase" | "dataforseo";
  searchMaps(input: MapsRankRequest): Promise<MapsRankResult>;
}
```

Normalize every provider response into the same shape:

```ts
type RankPoint = {
  lat: number;
  lon: number;
  rank: number | null;
  matchedBusinessId?: string;
  matchedName?: string;
  competitors: Array<{ name: string; rank: number }>;
  rawProviderId: string;
};
```

Current implementation status:

1. Cloudflare backend route for `/api/scans` exists.
2. Grid coordinates are generated server-side from center latitude, longitude, grid size, and spacing.
3. Scrappa API keys are expected to be stored as Cloudflare secrets.
4. Scrappa responses are normalized into the existing territory/rank-cell shape.
5. Live mode requires `ENABLE_LIVE_SCANS=true` and defaults to an 81-point cap.
6. The frontend falls back to an explicitly labeled estimate if live mode is unavailable.

Recommended next rollout:

1. Add scan persistence and caching so duplicate live scans do not create accidental provider costs.
2. QA Scrappa result matching against manual Google Maps checks for 10-20 real businesses.
3. Add a city/address geocoder so users do not need to paste center coordinates manually.
4. Add SerpBase as a fallback adapter after Scrappa is proven.
5. Add DataForSEO only when paid usage justifies the larger provider footprint.
