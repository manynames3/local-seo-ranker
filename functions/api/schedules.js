import { accountResponse, requireAccount } from "../_lib/auth.js";
import { addDaysIso, nowIso } from "../_lib/db.js";
import { jsonResponse, optionsResponse, readJson } from "../_lib/http.js";
import { hasValidCoordinates, normalizeScanInput } from "../_lib/scan-utils.js";

const FREQUENCIES = new Set(["daily", "weekly", "monthly"]);

export async function onRequestOptions({ request, env = {} }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env = {} }) {
  const auth = await requireAccount(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(20, Number.parseInt(url.searchParams.get("limit") || "10", 10)));
  const rows = await env.DB.prepare(
    `SELECT *
     FROM scan_schedules
     WHERE org_id = ?
     ORDER BY updated_at DESC
     LIMIT ?`
  )
    .bind(auth.account.org.id, limit)
    .all();

  return jsonResponse(request, env, {
    ok: true,
    schedules: (rows.results || []).map(scheduleResponse)
  });
}

export async function onRequestPost({ request, env = {} }) {
  const auth = await requireAccount(request, env);
  if (auth.response) return auth.response;

  const body = await readJson(request);
  if (!body) return jsonResponse(request, env, { error: "Request body must be valid JSON.", code: "invalid_json" }, 400);

  const input = normalizeScanInput(body.input || body);
  const missing = ["businessName", "websiteUrl", "keyword", "city", "state"].filter((key) => !input[key]);
  if (missing.length) return jsonResponse(request, env, { error: "Missing required fields.", code: "missing_fields", missing }, 400);
  if (!hasValidCoordinates(input)) {
    return jsonResponse(request, env, { error: "Scheduled live scans require center latitude and longitude.", code: "missing_center_coordinates" }, 422);
  }

  const frequency = FREQUENCIES.has(body.frequency) ? body.frequency : "weekly";
  const threshold = normalizeThreshold(body.threshold);
  const now = nowIso();
  const schedule = {
    id: crypto.randomUUID(),
    orgId: auth.account.org.id,
    userId: auth.account.user.id,
    input,
    frequency,
    threshold,
    alertEmail: clean(body.alertEmail || auth.account.user.email),
    status: "active",
    nextRunAt: nextRunAt(frequency),
    createdAt: now,
    updatedAt: now
  };

  await env.DB.prepare(
    `INSERT INTO scan_schedules
      (id, org_id, user_id, business_name, website_url, keyword, city, state, grid_size,
       center_lat, center_lon, point_spacing_km, frequency, alert_threshold, alert_email,
       status, next_run_at, created_at, updated_at, request_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      schedule.id,
      schedule.orgId,
      schedule.userId,
      input.businessName,
      input.websiteUrl,
      input.keyword,
      input.city,
      input.state,
      input.gridSize,
      input.centerLat,
      input.centerLon,
      input.pointSpacingKm,
      schedule.frequency,
      schedule.threshold,
      schedule.alertEmail,
      schedule.status,
      schedule.nextRunAt,
      schedule.createdAt,
      schedule.updatedAt,
      JSON.stringify({ ...input, scanMode: "live" })
    )
    .run();

  const rows = await env.DB.prepare(
    `SELECT *
     FROM scan_schedules
     WHERE org_id = ?
     ORDER BY updated_at DESC
     LIMIT 6`
  )
    .bind(auth.account.org.id)
    .all();

  return jsonResponse(request, env, {
    ok: true,
    schedule: scheduleResponseFromInput(schedule),
    schedules: (rows.results || []).map(scheduleResponse),
    account: accountResponse(auth.account, auth.subscription)
  });
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

function scheduleResponseFromInput(schedule) {
  return {
    id: schedule.id,
    businessName: schedule.input.businessName,
    websiteUrl: schedule.input.websiteUrl,
    keyword: schedule.input.keyword,
    city: schedule.input.city,
    state: schedule.input.state,
    gridSize: `${schedule.input.gridSize} x ${schedule.input.gridSize}`,
    frequency: schedule.frequency,
    threshold: schedule.threshold,
    alertEmail: schedule.alertEmail,
    status: schedule.status,
    nextRunAt: schedule.nextRunAt,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt
  };
}

function normalizeThreshold(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 7;
  return Math.max(3, Math.min(20, parsed));
}

function nextRunAt(frequency) {
  if (frequency === "daily") return addDaysIso(1);
  if (frequency === "monthly") return addDaysIso(30);
  return addDaysIso(7);
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}
