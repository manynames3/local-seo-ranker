import {
  buildTerritoryFromRankPoints,
  generateGridPoints,
  hasValidCoordinates,
  matchBusiness,
  normalizeScanInput,
  normalizeScrappaItems
} from "../_lib/scan-utils.js";
import { accountResponse, requireAccount } from "../_lib/auth.js";
import { addDaysIso, consumeCredits, enforceRateLimit, nowIso, sha256Hex } from "../_lib/db.js";
import { jsonResponse, optionsResponse } from "../_lib/http.js";

export async function onRequestOptions({ request, env = {} }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env = {} }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, env, { error: "Request body must be valid JSON." }, 400);
  }

  const input = normalizeScanInput(body);
  const missing = requiredFields(input);
  if (missing.length) {
    return jsonResponse(request, env, { error: "Missing required fields.", missing }, 400);
  }

  if (input.scanMode !== "live") {
    return jsonResponse(request, env, buildUnavailableResponse(input, "estimate_mode"));
  }

  const auth = await requireAccount(request, env);
  if (auth.response) return auth.response;

  if (!liveScansEnabled(env)) {
    return jsonResponse(request, env, buildUnavailableResponse(input, "live_scans_disabled"), 409);
  }

  if (!env.SCRAPPA_API_KEY) {
    return jsonResponse(request, env, buildUnavailableResponse(input, "missing_scrappa_key"), 409);
  }

  const requestedPoints = input.gridSize * input.gridSize;
  const maxPoints = maxLiveGridPoints(env);
  if (requestedPoints > maxPoints) {
    return jsonResponse(request, env, buildUnavailableResponse(input, "grid_too_large", { maxPoints }), 422);
  }

  if (!hasValidCoordinates(input)) {
    return jsonResponse(request, env, buildUnavailableResponse(input, "missing_center_coordinates"), 422);
  }

  await enforceRateLimit(env.DB, { orgId: auth.account.org.id, userId: auth.account.user.id, route: "scan", limit: 12, windowMinutes: 60 });
  const cacheKey = await buildScanCacheKey(input);
  const cached = await getCachedScan(env.DB, auth.account.org.id, cacheKey);
  if (cached) {
    const scan = {
      ...cached,
      ok: true,
      mode: "live",
      cached: true,
      requestCostCredits: 0,
      chargedCredits: 0,
      modelStatus: "Cached live Maps data. No provider request was made for this scan."
    };
    await saveScanRecord(env.DB, { auth, input, cacheKey, scan, status: "cached", requestCredits: requestedPoints, chargedCredits: 0 });
    return jsonResponse(request, env, { ...scan, account: accountResponse(auth.account, auth.subscription) });
  }

  try {
    const subscription = await consumeCredits(env.DB, {
      orgId: auth.account.org.id,
      userId: auth.account.user.id,
      credits: requestedPoints,
      kind: "scan",
      description: `${input.gridSize}x${input.gridSize} ${input.keyword} in ${input.city}, ${input.state}`
    });
    const scan = await runScrappaGrid(input, env.SCRAPPA_API_KEY);
    scan.chargedCredits = requestedPoints;
    scan.account = accountResponse(auth.account, subscription);
    await saveScanCache(env.DB, auth.account.org.id, cacheKey, scan, requestedPoints);
    await saveScanRecord(env.DB, { auth, input, cacheKey, scan, status: "complete", requestCredits: requestedPoints, chargedCredits: requestedPoints });
    return jsonResponse(request, env, scan);
  } catch (error) {
    if (error.code === "insufficient_credits") {
      return jsonResponse(
        request,
        env,
        {
          error: error.message,
          code: error.code,
          credits: error.creditSummary
        },
        402
      );
    }
    if (error.code === "rate_limited") {
      return jsonResponse(request, env, { error: error.message, code: error.code }, 429);
    }
    return jsonResponse(
      request,
      env,
      {
        error: "Live scan failed.",
        reason: error instanceof Error ? error.message : "Unknown provider error.",
        mode: "provider_error",
        provider: "scrappa"
      },
      502
    );
  }
}

export async function onRequestGet({ request, env = {} }) {
  return jsonResponse(request, env, {
    ok: true,
    endpoint: "/api/scans",
    methods: ["POST"],
    provider: "scrappa",
    liveEnabled: liveScansEnabled(env),
    maxLiveGridPoints: maxLiveGridPoints(env),
    requiredForLive: [
      "businessName",
      "websiteUrl",
      "keyword",
      "city",
      "state",
      "centerLat",
      "centerLon",
      "SCRAPPA_API_KEY",
      "ENABLE_LIVE_SCANS=true"
    ]
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
    modelStatus: "Live Maps rank data. Rank cells are matched against returned Maps results.",
    requestCostCredits: points.length,
    warnings: [],
    territory: buildTerritoryFromRankPoints({ input, points: results, provider: "scrappa" })
  };
}

function buildUnavailableResponse(input, reason, extra = {}) {
  const points = hasValidCoordinates(input)
    ? generateGridPoints(input).map((point) => ({ ...point, rank: null }))
    : [];

  return {
    ok: false,
    mode: "unavailable",
    provider: "scrappa",
    reason,
    modelStatus: statusForUnavailable(reason),
    ...extra,
    requestCostCredits: hasValidCoordinates(input) ? input.gridSize * input.gridSize : 0,
    territory: points.length
      ? buildTerritoryFromRankPoints({ input, points, provider: "fallback" })
      : null
  };
}

function statusForUnavailable(reason) {
  const statuses = {
    estimate_mode: "Estimate mode selected. No provider request was made.",
    live_scans_disabled: "Live Maps scans are not available on this deployment.",
    grid_too_large: "Requested grid exceeds the live scan cap. Choose a smaller grid or raise MAX_LIVE_GRID_POINTS.",
    missing_scrappa_key: "Live Maps scans require a configured provider key.",
    missing_center_coordinates: "Live Maps scans require a center latitude and longitude."
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

async function buildScanCacheKey(input) {
  return sha256Hex(
    JSON.stringify({
      businessName: input.businessName.toLowerCase(),
      websiteUrl: input.websiteUrl.toLowerCase(),
      mapsUrl: input.mapsUrl,
      keyword: input.keyword.toLowerCase(),
      city: input.city.toLowerCase(),
      state: input.state.toLowerCase(),
      gridSize: input.gridSize,
      centerLat: input.centerLat,
      centerLon: input.centerLon,
      pointSpacingKm: input.pointSpacingKm
    })
  );
}

async function getCachedScan(db, orgId, cacheKey) {
  const row = await db
    .prepare("SELECT response_json FROM scan_cache WHERE org_id = ? AND cache_key = ? AND expires_at > ?")
    .bind(orgId, cacheKey, nowIso())
    .first();
  return row ? JSON.parse(row.response_json) : null;
}

async function saveScanCache(db, orgId, cacheKey, scan, requestCredits) {
  const createdAt = nowIso();
  await db
    .prepare(
      `INSERT OR REPLACE INTO scan_cache (cache_key, org_id, response_json, provider, request_credits, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(cacheKey, orgId, JSON.stringify(stripAccount(scan)), scan.provider || "scrappa", requestCredits, createdAt, addDaysIso(1))
    .run();
}

async function saveScanRecord(db, { auth, input, cacheKey, scan, status, requestCredits, chargedCredits }) {
  const territory = scan.territory || {};
  await db
    .prepare(
      `INSERT INTO scans
       (id, org_id, user_id, cache_key, business_name, website_url, keyword, city, state, grid_size,
        mode, provider, status, request_credits, charged_credits, avg_rank, coverage, weak, created_at, report_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      auth.account.org.id,
      auth.account.user.id,
      cacheKey,
      input.businessName,
      input.websiteUrl,
      input.keyword,
      input.city,
      input.state,
      input.gridSize,
      scan.mode || "live",
      scan.provider || "scrappa",
      status,
      requestCredits,
      chargedCredits,
      territory.averageRank,
      territory.coverage,
      territory.weak,
      nowIso(),
      JSON.stringify(stripAccount(scan))
    )
    .run();
}

function stripAccount(scan) {
  const clone = { ...scan };
  delete clone.account;
  return clone;
}

function liveScansEnabled(env = {}) {
  return String(env.ENABLE_LIVE_SCANS || "").toLowerCase() === "true";
}

function maxLiveGridPoints(env = {}) {
  const parsed = Number.parseInt(env.MAX_LIVE_GRID_POINTS, 10);
  if (!Number.isFinite(parsed)) return 81;
  return Math.max(9, Math.min(121, parsed));
}
