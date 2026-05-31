import { requireAccount } from "../_lib/auth.js";
import { jsonResponse, optionsResponse } from "../_lib/http.js";

export async function onRequestOptions({ request, env = {} }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env = {} }) {
  const auth = await requireAccount(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const limit = clamp(Number.parseInt(url.searchParams.get("limit") || "20", 10), 1, 50);
  const rows = await env.DB
    .prepare(
      `SELECT id, business_name, website_url, keyword, city, state, grid_size, mode, provider, status,
              request_credits, charged_credits, avg_rank, coverage, weak, created_at
       FROM scans
       WHERE org_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(auth.account.org.id, limit)
    .all();

  return jsonResponse(request, env, {
    ok: true,
    scans: (rows.results || []).map((row) => ({
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

function clamp(value, min, max) {
  const safe = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, safe));
}
