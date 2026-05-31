import {
  buildTerritoryFromRankPoints,
  generateGridPoints,
  hasValidCoordinates,
  matchBusiness,
  normalizeScanInput,
  normalizeScrappaItems
} from "../_lib/scan-utils.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const input = normalizeScanInput(body);
  const missing = requiredFields(input);
  if (missing.length) {
    return jsonResponse({ error: "Missing required fields.", missing }, 400);
  }

  if (input.scanMode !== "live") {
    return jsonResponse(buildUnavailableResponse(input, "estimate_mode"));
  }

  if (!env.SCRAPPA_API_KEY) {
    return jsonResponse(buildUnavailableResponse(input, "missing_scrappa_key"), 409);
  }

  if (!hasValidCoordinates(input)) {
    return jsonResponse(buildUnavailableResponse(input, "missing_center_coordinates"), 422);
  }

  try {
    const scan = await runScrappaGrid(input, env.SCRAPPA_API_KEY);
    return jsonResponse(scan);
  } catch (error) {
    return jsonResponse(
      {
        error: "Scrappa scan failed.",
        reason: error instanceof Error ? error.message : "Unknown provider error.",
        mode: "provider_error",
        provider: "scrappa"
      },
      502
    );
  }
}

export async function onRequestGet() {
  return jsonResponse({
    ok: true,
    endpoint: "/api/scans",
    methods: ["POST"],
    provider: "scrappa",
    requiredForLive: ["businessName", "websiteUrl", "keyword", "city", "state", "centerLat", "centerLon", "SCRAPPA_API_KEY"]
  });
}

async function runScrappaGrid(input, apiKey) {
  const startedAt = new Date().toISOString();
  const points = generateGridPoints(input);
  const fields = "name,business_id,website,phone,address,rating,review_count,lat,lon";
  const results = [];

  await mapWithConcurrency(points, 4, async (point) => {
    const url = new URL("https://scrappa.co/api/maps/advanced-search");
    url.searchParams.set("query", input.keyword);
    url.searchParams.set("zoom", "13");
    url.searchParams.set("lat", String(point.lat));
    url.searchParams.set("lon", String(point.lon));
    url.searchParams.set("limit", "20");
    url.searchParams.set("fields", fields);
    url.searchParams.set("hl", "en");
    url.searchParams.set("gl", "us");

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Scrappa returned ${response.status} for ${point.lat},${point.lon}`);
    }

    const payload = await response.json();
    const items = normalizeScrappaItems(payload);
    const match = matchBusiness(items, input);
    results.push({
      ...point,
      rank: match ? match.rank : null,
      matchedName: match?.item?.name || "",
      resultCount: items.length,
      providerRequestId: payload.request_id || payload.id || ""
    });
  });

  results.sort((a, b) => a.y - b.y || a.x - b.x);

  return {
    ok: true,
    mode: "live",
    provider: "scrappa",
    generatedAt: new Date().toISOString(),
    startedAt,
    modelStatus: "Live Scrappa Maps data. Rank cells are matched against returned Maps results.",
    requestCostCredits: points.length,
    warnings: [],
    territory: buildTerritoryFromRankPoints({ input, points: results, provider: "scrappa" })
  };
}

function buildUnavailableResponse(input, reason) {
  const points = hasValidCoordinates(input)
    ? generateGridPoints(input).map((point) => ({ ...point, rank: null }))
    : [];

  return {
    ok: false,
    mode: "unavailable",
    provider: "scrappa",
    reason,
    modelStatus: statusForUnavailable(reason),
    requestCostCredits: hasValidCoordinates(input) ? input.gridSize * input.gridSize : 0,
    territory: points.length
      ? buildTerritoryFromRankPoints({ input, points, provider: "fallback" })
      : null
  };
}

function statusForUnavailable(reason) {
  const statuses = {
    estimate_mode: "Estimate mode selected. No provider request was made.",
    missing_scrappa_key: "Live Scrappa scans require SCRAPPA_API_KEY on the Cloudflare backend.",
    missing_center_coordinates: "Live Scrappa scans require a center latitude and longitude until geocoding is added."
  };
  return statuses[reason] || "Live scan unavailable.";
}

function requiredFields(input) {
  return ["businessName", "websiteUrl", "keyword", "city", "state"].filter((key) => !input[key]);
}

async function mapWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...jsonHeaders,
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
