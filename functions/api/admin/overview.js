import { requireAccount } from "../../_lib/auth.js";
import { jsonResponse, optionsResponse } from "../../_lib/http.js";

export async function onRequestOptions({ request, env = {} }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env = {} }) {
  const auth = await requireAccount(request, env);
  if (auth.response) return auth.response;
  if (auth.account.user.role !== "admin") {
    return jsonResponse(request, env, { error: "Admin access required.", code: "admin_required" }, 403);
  }

  const [users, organizations, scans, schedules, usage, recentUsers, recentScans, subscriptions] = await Promise.all([
    firstNumber(env.DB, "SELECT COUNT(*) AS count FROM users"),
    firstNumber(env.DB, "SELECT COUNT(*) AS count FROM organizations"),
    firstNumber(env.DB, "SELECT COUNT(*) AS count FROM scans"),
    firstNumber(env.DB, "SELECT COUNT(*) AS count FROM scan_schedules"),
    firstNumber(env.DB, "SELECT COALESCE(SUM(credits), 0) AS count FROM usage_events"),
    env.DB.prepare("SELECT email, name, role, created_at, last_seen_at FROM users ORDER BY created_at DESC LIMIT 8").all(),
    env.DB
      .prepare(
        `SELECT business_name, keyword, city, state, mode, status, charged_credits, created_at
         FROM scans
         ORDER BY created_at DESC
         LIMIT 8`
      )
      .all(),
    env.DB
      .prepare(
        `SELECT subscriptions.plan, subscriptions.status, subscriptions.monthly_credit_limit, subscriptions.credits_used,
                subscriptions.period_end, organizations.name AS organization
         FROM subscriptions
         JOIN organizations ON organizations.id = subscriptions.org_id
         ORDER BY subscriptions.updated_at DESC
         LIMIT 8`
      )
      .all()
  ]);

  return jsonResponse(request, env, {
    ok: true,
    totals: {
      users,
      organizations,
      scans,
      schedules,
      creditsUsed: usage
    },
    recentUsers: recentUsers.results || [],
    recentScans: recentScans.results || [],
    subscriptions: subscriptions.results || []
  });
}

async function firstNumber(db, sql) {
  const row = await db.prepare(sql).first();
  return Number(row?.count || 0);
}
