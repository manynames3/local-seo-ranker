import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTerritoryFromRankPoints,
  generateGridPoints,
  matchBusiness,
  normalizeGridSize,
  normalizeScanInput,
  summarizeRankPoints
} from "../functions/_lib/scan-utils.js";
import { onRequestPost } from "../functions/api/scans.js";

test("normalizes grid size to supported odd values", () => {
  assert.equal(normalizeGridSize(8), 7);
  assert.equal(normalizeGridSize(12), 11);
  assert.equal(normalizeGridSize("bad"), 9);
});

test("generates a centered coordinate grid", () => {
  const points = generateGridPoints({ centerLat: 33.749, centerLon: -84.388, gridSize: 3, pointSpacingKm: 2 });
  assert.equal(points.length, 9);
  assert.deepEqual(points[4], { x: 1, y: 1, lat: 33.749, lon: -84.388 });
  assert.ok(points[0].lat > points[4].lat);
  assert.ok(points[8].lon > points[4].lon);
});

test("matches a business by domain or name", () => {
  const match = matchBusiness(
    [
      { name: "Another Roofer", website: "https://other.example" },
      { name: "Hometown Roofing Atlanta", website: "https://atlanta-hometownroofing.example" }
    ],
    normalizeScanInput({
      businessName: "Hometown Roofing Atlanta",
      websiteUrl: "https://atlanta-hometownroofing.example",
      keyword: "roof repair",
      city: "Atlanta",
      state: "GA"
    })
  );

  assert.equal(match.rank, 2);
});

test("summarizes rank points for report rendering", () => {
  const points = [
    { rank: 1 },
    { rank: 3 },
    { rank: 8 },
    { rank: null }
  ];
  const summary = summarizeRankPoints(points, 3, 2);
  assert.equal(summary.coverage, 50);
  assert.equal(summary.weak, 1);
  assert.equal(summary.averageRank, 4);
});

test("builds the territory contract used by the frontend", () => {
  const input = normalizeScanInput({
    businessName: "Hometown Roofing Atlanta",
    websiteUrl: "https://atlanta-hometownroofing.example",
    keyword: "roof repair",
    city: "Atlanta",
    state: "GA",
    gridSize: 3,
    centerLat: 33.749,
    centerLon: -84.388
  });
  const points = generateGridPoints(input).map((point, index) => ({ ...point, rank: index + 1 }));
  const territory = buildTerritoryFromRankPoints({ input, points, provider: "scrappa" });
  assert.equal(territory.size, 3);
  assert.equal(territory.cells.length, 9);
  assert.equal(territory.cells[4].center, true);
  assert.equal(territory.provider, "scrappa");
});

test("keeps live scans disabled until explicitly enabled", async () => {
  const response = await onRequestPost({
    request: new Request("https://local-seo-ranker.pages.dev/api/scans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(liveRequestBody({ gridSize: 9 }))
    }),
    env: { SCRAPPA_API_KEY: "fake-key" }
  });
  const payload = await response.json();
  assert.equal(response.status, 409);
  assert.equal(payload.reason, "live_scans_disabled");
  assert.equal(payload.requestCostCredits, 81);
});

test("blocks live scans above the backend point cap", async () => {
  const response = await onRequestPost({
    request: new Request("https://local-seo-ranker.pages.dev/api/scans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(liveRequestBody({ gridSize: 11 }))
    }),
    env: { SCRAPPA_API_KEY: "fake-key", ENABLE_LIVE_SCANS: "true" }
  });
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.reason, "grid_too_large");
  assert.equal(payload.maxPoints, 81);
});

function liveRequestBody(overrides = {}) {
  return {
    businessName: "Hometown Roofing Atlanta",
    websiteUrl: "https://atlanta-hometownroofing.example",
    keyword: "roof repair",
    city: "Atlanta",
    state: "GA",
    scanMode: "live",
    centerLat: 33.749,
    centerLon: -84.388,
    ...overrides
  };
}
