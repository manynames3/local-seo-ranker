import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { createHash, randomUUID } from "node:crypto";
import {
  buildTerritoryFromRankPoints,
  generateGridPoints,
  hasValidCoordinates,
  matchBusiness,
  normalizeScanInput,
  normalizeScrappaItems
} from "../../functions/_lib/scan-utils.js";

const ddb = new DynamoDBClient({});
const ssm = new SSMClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const SESSION_COOKIE = "lsr_session";
let scrappaKeyCache = null;

export async function handler(event) {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const path = event?.rawPath || event?.path || "/";

  try {
    if (method === "OPTIONS") return emptyResponse(event);
    if (method === "POST" && path === "/api/auth/login") return login(event);
    if (method === "GET" && path === "/api/auth/me") return me(event);
    if (method === "POST" && path === "/api/auth/logout") return logout(event);
    if (method === "POST" && path === "/api/geocode") return geocode(event);
    if (method === "GET" && path === "/api/history") return history(event);
    if (method === "GET" && path === "/api/schedules") return schedules(event);
    if (method === "POST" && path === "/api/schedules") return saveSchedule(event);
    if (method === "GET" && path === "/api/admin/overview") return adminOverview(event);
    if (method === "GET" && path === "/api/scans") return scansMetadata(event);
    if (method === "POST" && path === "/api/scans") return scans(event);
    return jsonResponse(event, { error: "Not found.", code: "not_found" }, 404);
  } catch (error) {
    console.error(error);
    return jsonResponse(
      event,
      { error: "Request failed.", code: "server_error", reason: error instanceof Error ? error.message : "Unknown error." },
      500
    );
  }
}

async function login(event) {
  const body = readJson(event);
  if (!body) return jsonResponse(event, { error: "Request body must be valid JSON.", code: "invalid_json" }, 400);

  const email = normalizeEmail(body.email);
  const name = clean(body.name);
  const accessCode = clean(body.accessCode);
  if (!email || !email.includes("@")) return jsonResponse(event, { error: "Enter a valid email address.", code: "invalid_email" }, 400);

  const configuredCode = clean(process.env.APP_ACCESS_CODE);
  const openSignup = String(process.env.ALLOW_OPEN_SIGNUPS || "").toLowerCase() === "true";
  const firstUserBootstrap = !configuredCode && (await countUsers()) === 0;
  const existingUser = await getItem(`USER#${email}`, "PROFILE");
  if (!existingUser && !openSignup && !firstUserBootstrap && (!configuredCode || accessCode !== configuredCode)) {
    return jsonResponse(event, { error: "Access code is required.", code: "invalid_access_code" }, 401);
  }

  const account = await getOrCreateAccount({ email, name, forceAdmin: firstUserBootstrap });
  const token = randomToken();
  const tokenHash = sha256Hex(token);
  const now = nowIso();
  await putItem({
    PK: `SESSION#${tokenHash}`,
    SK: "PROFILE",
    type: "session",
    user_id: account.user.id,
    email,
    org_id: account.org.id,
    expires_at: addDaysIso(30),
    created_at: now,
    last_seen_at: now,
    ttl: epochSeconds(addDaysIso(35))
  });

  const subscription = await ensureSubscription(account.org.id);
  return jsonResponse(event, { ok: true, account: accountResponse(account, subscription) }, 200, {}, [sessionCookie(token)]);
}

async function me(event) {
  const auth = await requireAccount(event);
  if (auth.response) return auth.response;
  return jsonResponse(event, { ok: true, account: accountResponse(auth.account, auth.subscription) });
}

async function logout(event) {
  const token = sessionToken(event);
  if (token) {
    await deleteItem(`SESSION#${sha256Hex(token)}`, "PROFILE");
  }
  return jsonResponse(event, { ok: true }, 200, {}, [clearSessionCookie()]);
}

async function geocode(event) {
  const auth = await requireAccount(event);
  if (auth.response) return auth.response;

  const body = readJson(event);
  if (!body) return jsonResponse(event, { error: "Request body must be valid JSON.", code: "invalid_json" }, 400);

  const query = clean(body.query) || [body.businessName, body.city, body.state].map(clean).filter(Boolean).join(", ");
  if (!query) return jsonResponse(event, { error: "Business name, city, and state are required.", code: "missing_query" }, 400);

  const queryKey = sha256Hex(query.toLowerCase());
  const cached = await getCache(auth.account.org.id, `GEOCODE_CACHE#${queryKey}`);
  if (cached) {
    return jsonResponse(event, { ...cached, ok: true, cached: true, chargedCredits: 0, account: accountResponse(auth.account, auth.subscription) });
  }

  const apiKey = await getScrappaKey();
  if (!apiKey) return jsonResponse(event, { error: "Live lookup provider is not configured.", code: "missing_provider_key" }, 409);

  try {
    await enforceRateLimit(auth.account, "geocode", 30, 60);
    const subscription = await consumeCredits(auth.account, 1, "geocode", `Find center for ${query}`);
    const geocodeResult = await lookupMapsCenter(query, apiKey);
    await putCache(auth.account.org.id, `GEOCODE_CACHE#${queryKey}`, geocodeResult, 30);
    return jsonResponse(event, { ...geocodeResult, ok: true, cached: false, chargedCredits: 1, account: accountResponse(auth.account, subscription) });
  } catch (error) {
    return providerError(event, error, "Could not find a reliable map center.", "geocode_failed");
  }
}

async function scans(event) {
  const body = readJson(event);
  if (!body) return jsonResponse(event, { error: "Request body must be valid JSON." }, 400);

  const input = normalizeScanInput(body);
  const missing = ["businessName", "websiteUrl", "keyword", "city", "state"].filter((key) => !input[key]);
  if (missing.length) return jsonResponse(event, { error: "Missing required fields.", missing }, 400);

  if (input.scanMode !== "live") return jsonResponse(event, buildUnavailableResponse(input, "estimate_mode"));

  const auth = await requireAccount(event);
  if (auth.response) return auth.response;

  if (String(process.env.ENABLE_LIVE_SCANS || "").toLowerCase() !== "true") {
    return jsonResponse(event, buildUnavailableResponse(input, "live_scans_disabled"), 409);
  }
  const apiKey = await getScrappaKey();
  if (!apiKey) return jsonResponse(event, buildUnavailableResponse(input, "missing_scrappa_key"), 409);

  const requestedPoints = input.gridSize * input.gridSize;
  const maxPoints = maxLiveGridPoints();
  if (requestedPoints > maxPoints) return jsonResponse(event, buildUnavailableResponse(input, "grid_too_large", { maxPoints }), 422);
  if (!hasValidCoordinates(input)) return jsonResponse(event, buildUnavailableResponse(input, "missing_center_coordinates"), 422);

  await enforceRateLimit(auth.account, "scan", 12, 60);
  const cacheKey = buildScanCacheKey(input);
  const cached = await getCache(auth.account.org.id, `SCAN_CACHE#${cacheKey}`);
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
    await saveScanRecord(auth, input, cacheKey, scan, "cached", requestedPoints, 0);
    return jsonResponse(event, { ...scan, account: accountResponse(auth.account, auth.subscription) });
  }

  try {
    const subscription = await consumeCredits(auth.account, requestedPoints, "scan", `${input.gridSize}x${input.gridSize} ${input.keyword} in ${input.city}, ${input.state}`);
    const scan = await runScrappaGrid(input, apiKey);
    scan.chargedCredits = requestedPoints;
    scan.account = accountResponse(auth.account, subscription);
    await putCache(auth.account.org.id, `SCAN_CACHE#${cacheKey}`, stripAccount(scan), 1);
    await saveScanRecord(auth, input, cacheKey, scan, "complete", requestedPoints, requestedPoints);
    return jsonResponse(event, scan);
  } catch (error) {
    return providerError(event, error, "Live scan failed.", "provider_error");
  }
}

function scansMetadata(event) {
  return jsonResponse(event, {
    ok: true,
    endpoint: "/api/scans",
    methods: ["POST"],
    provider: "scrappa",
    liveEnabled: String(process.env.ENABLE_LIVE_SCANS || "").toLowerCase() === "true",
    maxLiveGridPoints: maxLiveGridPoints(),
    requiredForLive: ["businessName", "websiteUrl", "keyword", "city", "state", "centerLat", "centerLon", "SCRAPPA_PARAM_NAME", "ENABLE_LIVE_SCANS=true"]
  });
}

async function history(event) {
  const auth = await requireAccount(event);
  if (auth.response) return auth.response;
  const limit = Math.max(1, Math.min(50, Number.parseInt(new URL(event.rawQueryString ? `https://x/?${event.rawQueryString}` : "https://x/").searchParams.get("limit") || "20", 10)));
  const rows = await queryOrg(auth.account.org.id, "SCAN#", false, limit);
  return jsonResponse(event, {
    ok: true,
    scans: rows.map((row) => ({
      id: row.id,
      businessName: row.business_name,
      websiteUrl: row.website_url,
      keyword: row.keyword,
      city: row.city,
      state: row.state,
      gridSize: row.grid_size,
      mode: row.mode,
      provider: row.provider,
      status: row.status,
      requestCredits: row.request_credits,
      chargedCredits: row.charged_credits,
      averageRank: row.avg_rank,
      coverage: row.coverage,
      weak: row.weak,
      createdAt: row.created_at
    }))
  });
}

async function schedules(event) {
  const auth = await requireAccount(event);
  if (auth.response) return auth.response;
  const limit = Math.max(1, Math.min(20, Number.parseInt(new URL(event.rawQueryString ? `https://x/?${event.rawQueryString}` : "https://x/").searchParams.get("limit") || "10", 10)));
  const rows = await queryOrg(auth.account.org.id, "SCHEDULE#", false, limit);
  return jsonResponse(event, {
    ok: true,
    schedules: rows.map(scheduleResponse)
  });
}

async function saveSchedule(event) {
  const auth = await requireAccount(event);
  if (auth.response) return auth.response;

  const body = readJson(event);
  if (!body) return jsonResponse(event, { error: "Request body must be valid JSON.", code: "invalid_json" }, 400);

  const input = normalizeScanInput(body.input || body);
  const missing = ["businessName", "websiteUrl", "keyword", "city", "state"].filter((key) => !input[key]);
  if (missing.length) return jsonResponse(event, { error: "Missing required fields.", code: "missing_fields", missing }, 400);
  if (!hasValidCoordinates(input)) return jsonResponse(event, { error: "Scheduled live scans require center latitude and longitude.", code: "missing_center_coordinates" }, 422);

  const frequency = new Set(["daily", "weekly", "monthly"]).has(body.frequency) ? body.frequency : "weekly";
  const now = nowIso();
  const schedule = {
    PK: `ORG#${auth.account.org.id}`,
    SK: `SCHEDULE#${now}#${randomUUID()}`,
    type: "schedule",
    id: randomUUID(),
    org_id: auth.account.org.id,
    user_id: auth.account.user.id,
    business_name: input.businessName,
    website_url: input.websiteUrl,
    keyword: input.keyword,
    city: input.city,
    state: input.state,
    grid_size: input.gridSize,
    center_lat: input.centerLat,
    center_lon: input.centerLon,
    point_spacing_km: input.pointSpacingKm,
    frequency,
    alert_threshold: normalizeThreshold(body.threshold),
    alert_email: clean(body.alertEmail || auth.account.user.email),
    status: "active",
    next_run_at: scheduleNextRunAt(frequency),
    created_at: now,
    updated_at: now,
    request_json: JSON.stringify({ ...input, scanMode: "live" })
  };
  await putItem(schedule);
  const rows = await queryOrg(auth.account.org.id, "SCHEDULE#", false, 6);
  return jsonResponse(event, {
    ok: true,
    schedule: scheduleResponse(schedule),
    schedules: rows.map(scheduleResponse),
    account: accountResponse(auth.account, auth.subscription)
  });
}

async function adminOverview(event) {
  const auth = await requireAccount(event);
  if (auth.response) return auth.response;
  if (auth.account.user.role !== "admin") return jsonResponse(event, { error: "Admin access required.", code: "admin_required" }, 403);

  const scan = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  const items = (scan.Items || []).map(unmarshall);
  return jsonResponse(event, {
    ok: true,
    totals: {
      users: items.filter((item) => item.type === "user").length,
      organizations: items.filter((item) => item.type === "organization").length,
      scans: items.filter((item) => item.type === "scan").length,
      schedules: items.filter((item) => item.type === "schedule").length,
      creditsUsed: items.filter((item) => item.type === "usage").reduce((sum, item) => sum + Number(item.credits || 0), 0)
    },
    recentUsers: items.filter((item) => item.type === "user").sort(sortByCreatedDesc).slice(0, 8),
    recentScans: items.filter((item) => item.type === "scan").sort(sortByCreatedDesc).slice(0, 8),
    subscriptions: items.filter((item) => item.type === "subscription").slice(0, 8)
  });
}

async function requireAccount(event) {
  const token = sessionToken(event);
  if (!token) return { response: jsonResponse(event, { error: "Sign in to run live scans.", code: "auth_required" }, 401) };

  const session = await getItem(`SESSION#${sha256Hex(token)}`, "PROFILE");
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    return { response: jsonResponse(event, { error: "Session expired. Sign in again.", code: "session_expired" }, 401, {}, [clearSessionCookie()]) };
  }

  const user = await getItem(`USER#${session.email}`, "PROFILE");
  const org = await getItem(`ORG#${session.org_id}`, "PROFILE");
  const membership = await getItem(`ORG#${session.org_id}`, `MEMBER#${session.user_id}`);
  if (!user || !org || !membership) return { response: jsonResponse(event, { error: "No workspace found for this account.", code: "workspace_missing" }, 403) };

  await putItem({ ...session, last_seen_at: nowIso() });
  const subscription = await ensureSubscription(org.id);
  const role = adminEmails().has(user.email) ? "admin" : user.role || "member";
  return {
    account: {
      user: { id: user.id, email: user.email, name: user.name || "", role },
      org,
      membership
    },
    subscription
  };
}

async function getOrCreateAccount({ email, name, forceAdmin = false }) {
  const existing = await getItem(`USER#${email}`, "PROFILE");
  if (existing) {
    existing.last_seen_at = nowIso();
    if (name) existing.name = name;
    await putItem(existing);
    const orgRows = await scanByType("membership", "user_id", existing.id);
    const membership = orgRows[0];
    const org = await getItem(`ORG#${membership.org_id}`, "PROFILE");
    existing.role = forceAdmin || adminEmails().has(email) ? "admin" : existing.role;
    return { user: existing, org, membership };
  }

  const now = nowIso();
  const user = {
    PK: `USER#${email}`,
    SK: "PROFILE",
    type: "user",
    id: randomUUID(),
    email,
    name,
    role: forceAdmin || adminEmails().has(email) ? "admin" : "member",
    created_at: now,
    last_seen_at: now
  };
  const org = {
    PK: "",
    SK: "PROFILE",
    type: "organization",
    id: randomUUID(),
    name: name ? `${name}'s workspace` : `${email.split("@")[0]}'s workspace`,
    created_at: now
  };
  org.PK = `ORG#${org.id}`;
  const membership = {
    PK: org.PK,
    SK: `MEMBER#${user.id}`,
    type: "membership",
    user_id: user.id,
    org_id: org.id,
    role: "owner",
    created_at: now
  };
  await putItem(user);
  await putItem(org);
  await putItem(membership);
  return { user, org, membership };
}

async function ensureSubscription(orgId) {
  const existing = await getItem(`ORG#${orgId}`, "SUBSCRIPTION");
  if (existing) return existing;
  const now = nowIso();
  const monthlyCreditLimit = monthlyCreditLimitValue();
  const subscription = {
    PK: `ORG#${orgId}`,
    SK: "SUBSCRIPTION",
    type: "subscription",
    id: randomUUID(),
    org_id: orgId,
    plan: "starter",
    status: "active",
    monthly_credit_limit: monthlyCreditLimit,
    credits_used: 0,
    credits_remaining: monthlyCreditLimit,
    period_start: now,
    period_end: addDaysIso(30),
    updated_at: now
  };
  await putItem(subscription);
  return subscription;
}

async function consumeCredits(account, credits, kind, description) {
  if (credits <= 0) return ensureSubscription(account.org.id);
  const key = marshall({ PK: `ORG#${account.org.id}`, SK: "SUBSCRIPTION" });
  const now = nowIso();
  try {
    const result = await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: key,
        UpdateExpression: "SET credits_used = credits_used + :credits, credits_remaining = credits_remaining - :credits, updated_at = :now",
        ConditionExpression: "#status = :active AND credits_remaining >= :credits",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({ ":credits": credits, ":now": now, ":active": "active" }),
        ReturnValues: "ALL_NEW"
      })
    );
    await putItem({
      PK: `ORG#${account.org.id}`,
      SK: `USAGE#${now}#${randomUUID()}`,
      type: "usage",
      org_id: account.org.id,
      user_id: account.user.id,
      kind,
      credits,
      description,
      created_at: now
    });
    return unmarshall(result.Attributes);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      const summary = creditSummary(await ensureSubscription(account.org.id));
      const wrapped = new Error("Not enough scan credits remaining.");
      wrapped.code = "insufficient_credits";
      wrapped.creditSummary = summary;
      throw wrapped;
    }
    throw error;
  }
}

async function enforceRateLimit(account, route, limit, windowMinutes) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const rows = await queryOrg(account.org.id, `RATE#${route}#`, false, 100);
  if (rows.filter((row) => row.created_at >= since).length >= limit) {
    const error = new Error("Rate limit reached. Try again later.");
    error.code = "rate_limited";
    throw error;
  }
  const now = nowIso();
  await putItem({
    PK: `ORG#${account.org.id}`,
    SK: `RATE#${route}#${now}#${randomUUID()}`,
    type: "rate",
    org_id: account.org.id,
    user_id: account.user.id,
    route,
    created_at: now,
    ttl: epochSeconds(addDaysIso(2))
  });
}

async function saveScanRecord(auth, input, cacheKey, scan, status, requestCredits, chargedCredits) {
  const territory = scan.territory || {};
  const now = nowIso();
  await putItem({
    PK: `ORG#${auth.account.org.id}`,
    SK: `SCAN#${now}#${randomUUID()}`,
    type: "scan",
    id: randomUUID(),
    org_id: auth.account.org.id,
    user_id: auth.account.user.id,
    cache_key: cacheKey,
    business_name: input.businessName,
    website_url: input.websiteUrl,
    keyword: input.keyword,
    city: input.city,
    state: input.state,
    grid_size: input.gridSize,
    mode: scan.mode || "live",
    provider: scan.provider || "scrappa",
    status,
    request_credits: requestCredits,
    charged_credits: chargedCredits,
    avg_rank: territory.averageRank,
    coverage: territory.coverage,
    weak: territory.weak,
    created_at: now,
    report_json: JSON.stringify(stripAccount(scan))
  });
}

async function runScrappaGrid(input, apiKey) {
  const startedAt = nowIso();
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

    const response = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!response.ok) throw new Error(`Provider returned ${response.status} for ${point.lat},${point.lon}`);

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
    generatedAt: nowIso(),
    startedAt,
    modelStatus: "Observed live Maps rank data. Rank cells were matched against provider-returned Maps results.",
    requestCostCredits: points.length,
    warnings: [],
    territory: buildTerritoryFromRankPoints({ input, points: results, provider: "scrappa" })
  };
}

async function lookupMapsCenter(query, apiKey) {
  const url = new URL("https://scrappa.co/api/maps/advanced-search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("fields", "name,business_id,website,phone,address,rating,review_count,lat,lon");
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");

  const response = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  const payload = await response.json();
  const candidates = normalizeScrappaItems(payload).map(normalizeCandidate).filter((candidate) => Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon));
  const selected = candidates[0] || null;
  if (!selected) throw new Error("No candidate returned coordinates.");
  return { provider: "scrappa", query, selected, candidates, generatedAt: nowIso() };
}

async function getScrappaKey() {
  if (scrappaKeyCache !== null) return scrappaKeyCache;
  if (process.env.SCRAPPA_API_KEY) {
    scrappaKeyCache = process.env.SCRAPPA_API_KEY;
    return scrappaKeyCache;
  }
  const name = process.env.SCRAPPA_PARAM_NAME;
  if (!name) {
    scrappaKeyCache = "";
    return "";
  }
  try {
    const result = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    scrappaKeyCache = result.Parameter?.Value || "";
    return scrappaKeyCache;
  } catch (error) {
    console.warn(`Could not read provider key parameter ${name}: ${error.message}`);
    scrappaKeyCache = "";
    return "";
  }
}

async function getCache(orgId, sk) {
  const row = await getItem(`ORG#${orgId}`, sk);
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
  return JSON.parse(row.response_json);
}

async function putCache(orgId, sk, payload, days) {
  await putItem({
    PK: `ORG#${orgId}`,
    SK: sk,
    type: "cache",
    response_json: JSON.stringify(payload),
    created_at: nowIso(),
    expires_at: addDaysIso(days),
    ttl: epochSeconds(addDaysIso(days + 1))
  });
}

async function getItem(PK, SK) {
  const result = await ddb.send(new GetItemCommand({ TableName: TABLE_NAME, Key: marshall({ PK, SK }) }));
  return result.Item ? unmarshall(result.Item) : null;
}

async function putItem(item) {
  await ddb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: marshall(item) }));
}

async function deleteItem(PK, SK) {
  await ddb.send(new DeleteItemCommand({ TableName: TABLE_NAME, Key: marshall({ PK, SK }) }));
}

async function queryOrg(orgId, prefix, forward = true, limit = 20) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: marshall({ ":pk": `ORG#${orgId}`, ":prefix": prefix }),
      ScanIndexForward: forward,
      Limit: limit
    })
  );
  return (result.Items || []).map(unmarshall);
}

async function scanByType(type, attr, value) {
  const result = await ddb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "#type = :type AND #attr = :value",
      ExpressionAttributeNames: { "#type": "type", "#attr": attr },
      ExpressionAttributeValues: marshall({ ":type": type, ":value": value })
    })
  );
  return (result.Items || []).map(unmarshall);
}

async function countUsers() {
  const result = await ddb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      Select: "COUNT",
      FilterExpression: "#type = :type",
      ExpressionAttributeNames: { "#type": "type" },
      ExpressionAttributeValues: marshall({ ":type": "user" })
    })
  );
  return result.Count || 0;
}

function providerError(event, error, message, code) {
  if (error.code === "insufficient_credits") {
    return jsonResponse(event, { error: error.message, code: error.code, credits: error.creditSummary }, 402);
  }
  if (error.code === "rate_limited") {
    return jsonResponse(event, { error: error.message, code: error.code }, 429);
  }
  return jsonResponse(event, { error: message, code, reason: error instanceof Error ? error.message : "Unknown provider error." }, 502);
}

function buildUnavailableResponse(input, reason, extra = {}) {
  const points = hasValidCoordinates(input) ? generateGridPoints(input).map((point) => ({ ...point, rank: null })) : [];
  return {
    ok: false,
    mode: "unavailable",
    provider: "scrappa",
    reason,
    modelStatus: statusForUnavailable(reason),
    ...extra,
    requestCostCredits: hasValidCoordinates(input) ? input.gridSize * input.gridSize : 0,
    territory: points.length ? buildTerritoryFromRankPoints({ input, points, provider: "fallback" }) : null
  };
}

function statusForUnavailable(reason) {
  const statuses = {
    estimate_mode: "Estimate mode selected. No provider request was made.",
    live_scans_disabled: "Live Maps scans are not available on this deployment.",
    grid_too_large: "Requested grid exceeds the live scan cap.",
    missing_scrappa_key: "Live Maps scans require a configured provider key.",
    missing_center_coordinates: "Live Maps scans require a center latitude and longitude."
  };
  return statuses[reason] || "Live scan unavailable.";
}

function scheduleResponse(row) {
  return {
    id: row.id,
    businessName: row.business_name,
    websiteUrl: row.website_url,
    keyword: row.keyword,
    city: row.city,
    state: row.state,
    gridSize: `${row.grid_size} x ${row.grid_size}`,
    frequency: row.frequency,
    threshold: row.alert_threshold,
    alertEmail: row.alert_email || "",
    status: row.status,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeThreshold(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(3, Math.min(20, parsed)) : 7;
}

function scheduleNextRunAt(frequency) {
  if (frequency === "daily") return addDaysIso(1);
  if (frequency === "monthly") return addDaysIso(30);
  return addDaysIso(7);
}

function buildScanCacheKey(input) {
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

async function mapWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(workers);
}

function accountResponse(account, subscription) {
  return {
    user: account.user,
    organization: account.org,
    membership: account.membership,
    credits: creditSummary(subscription),
    admin: account.user.role === "admin"
  };
}

function creditSummary(subscription) {
  const monthlyLimit = Number(subscription?.monthly_credit_limit || 0);
  const used = Number(subscription?.credits_used || 0);
  const remaining = Number(subscription?.credits_remaining ?? Math.max(0, monthlyLimit - used));
  return {
    plan: subscription?.plan || "starter",
    status: subscription?.status || "inactive",
    monthlyLimit,
    used,
    remaining,
    periodEnd: subscription?.period_end || ""
  };
}

function jsonResponse(event, payload, statusCode = 200, headers = {}, cookies = []) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(event),
      ...headers
    },
    cookies,
    body: JSON.stringify(payload)
  };
}

function emptyResponse(event) {
  return { statusCode: 204, headers: corsHeaders(event), body: "" };
}

function corsHeaders(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin"
  };
}

function sessionToken(event) {
  const cookieHeader = event?.headers?.cookie || event?.headers?.Cookie || "";
  const pairs = [...(event.cookies || []), ...cookieHeader.split(";")]
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    });
  return Object.fromEntries(pairs)[SESSION_COOKIE] || "";
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function readJson(event) {
  try {
    if (!event.body) return {};
    const text = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function marshall(input) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toAttributeValue(value)])
  );
}

function unmarshall(input = {}) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, fromAttributeValue(value)]));
}

function toAttributeValue(value) {
  if (value === null) return { NULL: true };
  if (typeof value === "string") return { S: value };
  if (typeof value === "number") return { N: String(value) };
  if (typeof value === "boolean") return { BOOL: value };
  if (Array.isArray(value) || typeof value === "object") return { S: JSON.stringify(value) };
  return { S: String(value) };
}

function fromAttributeValue(value) {
  if ("S" in value) return value.S;
  if ("N" in value) return Number(value.N);
  if ("BOOL" in value) return value.BOOL;
  if ("NULL" in value) return null;
  return undefined;
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

function stripAccount(scan) {
  const clone = { ...scan };
  delete clone.account;
  return clone;
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sha256Hex(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function randomToken() {
  return randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function epochSeconds(iso) {
  return Math.floor(new Date(iso).getTime() / 1000);
}

function monthlyCreditLimitValue() {
  const parsed = Number.parseInt(process.env.DEFAULT_MONTHLY_CREDITS, 10);
  return Number.isFinite(parsed) ? Math.max(100, parsed) : 2500;
}

function maxLiveGridPoints() {
  const parsed = Number.parseInt(process.env.MAX_LIVE_GRID_POINTS, 10);
  return Number.isFinite(parsed) ? Math.max(9, Math.min(121, parsed)) : 81;
}

function adminEmails() {
  return new Set(String(process.env.ADMIN_EMAILS || "").split(",").map(normalizeEmail).filter(Boolean));
}

function sortByCreatedDesc(a, b) {
  return String(b.created_at || "").localeCompare(String(a.created_at || ""));
}
