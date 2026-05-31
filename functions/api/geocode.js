import { accountResponse, requireAccount } from "../_lib/auth.js";
import { addDaysIso, consumeCredits, enforceRateLimit, nowIso, sha256Hex } from "../_lib/db.js";
import { normalizeScrappaItems } from "../_lib/scan-utils.js";
import { jsonResponse, optionsResponse, readJson } from "../_lib/http.js";

export async function onRequestOptions({ request, env = {} }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env = {} }) {
  const auth = await requireAccount(request, env);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body) {
    return jsonResponse(request, env, { error: "Request body must be valid JSON.", code: "invalid_json" }, 400);
  }

  const query = buildGeocodeQuery(body);
  if (!query) {
    return jsonResponse(request, env, { error: "Business name, city, and state are required.", code: "missing_query" }, 400);
  }

  const queryKey = await sha256Hex(query.toLowerCase());
  const cached = await getCachedGeocode(env.DB, auth.account.org.id, queryKey);
  if (cached) {
    return jsonResponse(request, env, {
      ...cached,
      ok: true,
      cached: true,
      chargedCredits: 0,
      account: accountResponse(auth.account, auth.subscription)
    });
  }

  if (!env.SCRAPPA_API_KEY) {
    return jsonResponse(request, env, { error: "Live lookup provider is not configured.", code: "missing_provider_key" }, 409);
  }

  try {
    await enforceRateLimit(env.DB, { orgId: auth.account.org.id, userId: auth.account.user.id, route: "geocode", limit: 30, windowMinutes: 60 });
    const subscription = await consumeCredits(env.DB, {
      orgId: auth.account.org.id,
      userId: auth.account.user.id,
      credits: 1,
      kind: "geocode",
      description: `Find center for ${query}`
    });
    const geocode = await lookupMapsCenter(query, env.SCRAPPA_API_KEY);
    await saveGeocodeCache(env.DB, auth.account.org.id, queryKey, query, geocode);
    return jsonResponse(request, env, {
      ...geocode,
      ok: true,
      cached: false,
      chargedCredits: 1,
      account: accountResponse(auth.account, subscription)
    });
  } catch (error) {
    if (error.code === "insufficient_credits") {
      return jsonResponse(request, env, { error: error.message, code: error.code, credits: error.creditSummary }, 402);
    }
    if (error.code === "rate_limited") {
      return jsonResponse(request, env, { error: error.message, code: error.code }, 429);
    }
    return jsonResponse(
      request,
      env,
      {
        error: "Could not find a reliable map center.",
        code: "geocode_failed",
        reason: error instanceof Error ? error.message : "Unknown provider error."
      },
      502
    );
  }
}

function buildGeocodeQuery(body = {}) {
  const explicit = clean(body.query);
  if (explicit) return explicit;
  return [body.businessName, body.city, body.state].map(clean).filter(Boolean).join(", ");
}

async function lookupMapsCenter(query, apiKey) {
  const url = new URL("https://scrappa.co/api/maps/advanced-search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("fields", "name,business_id,website,phone,address,rating,review_count,lat,lon");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");

  const response = await fetch(url, {
    headers: {
      "x-api-key": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Provider returned ${response.status}`);
  }

  const payload = await response.json();
  const candidates = normalizeScrappaItems(payload).map(normalizeCandidate).filter((candidate) => Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon));
  const selected = candidates[0] || null;
  if (!selected) {
    throw new Error("No candidate returned coordinates.");
  }

  return {
    provider: "scrappa",
    query,
    selected,
    candidates,
    generatedAt: nowIso()
  };
}

async function getCachedGeocode(db, orgId, queryKey) {
  const row = await db
    .prepare("SELECT response_json FROM geocode_cache WHERE org_id = ? AND query_key = ? AND expires_at > ?")
    .bind(orgId, queryKey, nowIso())
    .first();
  return row ? JSON.parse(row.response_json) : null;
}

async function saveGeocodeCache(db, orgId, queryKey, query, geocode) {
  const createdAt = nowIso();
  await db
    .prepare(
      `INSERT OR REPLACE INTO geocode_cache (query_key, org_id, query, response_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(queryKey, orgId, query, JSON.stringify(geocode), createdAt, addDaysIso(30))
    .run();
}

function normalizeCandidate(item = {}) {
  return {
    id: clean(item.business_id || item.place_id || item.cid || item.data_id),
    name: clean(item.name || item.title || item.business_name),
    address: clean(item.address || item.full_address || item.formatted_address),
    website: clean(item.website || item.url || item.site),
    phone: clean(item.phone || item.phone_number),
    rating: toNumber(item.rating),
    reviewCount: toNumber(item.review_count || item.reviews),
    lat: toNumber(item.lat ?? item.latitude ?? item.gps_coordinates?.latitude ?? item.coordinates?.lat),
    lon: toNumber(item.lon ?? item.lng ?? item.longitude ?? item.gps_coordinates?.longitude ?? item.coordinates?.lng ?? item.coordinates?.lon)
  };
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
